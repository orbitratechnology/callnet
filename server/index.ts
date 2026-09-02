import { isCallEvent, isCallIdentity, type CallIdentity } from '../shared/call-protocol';
import { verifyFirebaseIdToken } from './firebase-token-verifier';

type Ack = (response: { ok: boolean; code?: string }) => void;

type SocketLike = {
  handshake: { auth?: unknown };
  data?: { identity?: CallIdentity };
  on(event: 'call:event' | 'disconnect', listener: (...args: unknown[]) => void): void;
  emit(event: 'call:event', payload: unknown): void;
  disconnect(close?: boolean): void;
};

type SocketServerLike = {
  on(event: 'connection', listener: (socket: SocketLike) => void): void;
  use?(listener: (socket: SocketLike, next: (error?: Error) => void) => void): void;
  listen?(port: number): void;
};

declare const require: (moduleName: string) => unknown;
declare const process: { env: Record<string, string | undefined> };

const { Server } = require('socket.io') as {
  Server: new (options: Record<string, unknown>) => SocketServerLike;
};

const port = Number(process.env.PORT ?? '8787');
const projectId = process.env.FIREBASE_PROJECT_ID ?? 'callnet-orbitra-20260902';
const socketsByIdentity = new Map<CallIdentity['uid'], SocketLike>();
const io = new Server({
  cors: { origin: '*' },
  transports: ['websocket'],
});

io.use?.((socket, next) => {
  const auth = socket.handshake.auth;
  const rawIdentity = auth && typeof auth === 'object' && 'identity' in auth
    ? (auth as { identity?: unknown }).identity
    : undefined;
  const token = auth && typeof auth === 'object' && 'token' in auth
    ? (auth as { token?: unknown }).token
    : undefined;

  if (!isCallIdentity(rawIdentity) || typeof token !== 'string' || token.length === 0) {
    next(new Error('unauthorized'));
    return;
  }

  void verifyFirebaseIdToken(token, projectId)
    .then((uid) => {
      if (uid !== rawIdentity.uid) {
        throw new Error('identity-mismatch');
      }
      socket.data = { identity: rawIdentity };
      next();
    })
    .catch((error: unknown) => {
      console.warn(`[signaling] auth rejected: ${error instanceof Error ? error.message : 'unknown-error'}`);
      next(new Error('unauthorized'));
    });
});

io.on('connection', (socket) => {
  const identity = socket.data?.identity;
  if (!identity) {
    socket.disconnect(true);
    return;
  }

  socketsByIdentity.get(identity.uid)?.disconnect(true);
  socketsByIdentity.set(identity.uid, socket);
  console.log(`[signaling] connected uid=${identity.uid.slice(0, 8)}`);

  socket.on('call:event', (...args: unknown[]) => {
    const [value, rawAck] = args;
    const ack = typeof rawAck === 'function' ? rawAck as Ack : undefined;

    if (!isCallEvent(value) || value.from !== identity.uid) {
      console.warn(`[signaling] invalid event uid=${identity.uid.slice(0, 8)}`);
      ack?.({ ok: false, code: 'invalid-call-event' });
      return;
    }

    const peer = socketsByIdentity.get(value.to);
    if (!peer) {
      console.warn(`[signaling] peer offline from=${identity.uid.slice(0, 8)} to=${value.to.slice(0, 8)} type=${value.type}`);
      ack?.({ ok: false, code: 'peer-offline' });
      return;
    }

    peer.emit('call:event', value);
    console.log(`[signaling] relayed from=${identity.uid.slice(0, 8)} to=${value.to.slice(0, 8)} type=${value.type}`);
    ack?.({ ok: true });
  });

  socket.on('disconnect', () => {
    console.log(`[signaling] disconnected uid=${identity.uid.slice(0, 8)}`);
    if (socketsByIdentity.get(identity.uid) === socket) {
      socketsByIdentity.delete(identity.uid);
    }
  });
});

io.listen?.(port);
