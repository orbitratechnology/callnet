import { isCallEvent, isDevelopmentIdentity, type DevelopmentIdentity } from '../shared/call-protocol';

type Ack = (response: { ok: boolean; code?: string }) => void;

type SocketLike = {
  handshake: { auth?: unknown };
  on(event: 'call:event' | 'disconnect', listener: (...args: unknown[]) => void): void;
  emit(event: 'call:event', payload: unknown): void;
  disconnect(close?: boolean): void;
};

type SocketServerLike = {
  on(event: 'connection', listener: (socket: SocketLike) => void): void;
  listen?(port: number): void;
};

declare const require: (moduleName: string) => unknown;
declare const process: { env: Record<string, string | undefined> };

const { Server } = require('socket.io') as {
  Server: new (options: Record<string, unknown>) => SocketServerLike;
};

if (process.env.NODE_ENV === 'production') {
  throw new Error('The seeded-identity signaling service is development-only.');
}

const port = Number(process.env.PORT ?? '8787');
const socketsByIdentity = new Map<DevelopmentIdentity['id'], SocketLike>();
const io = new Server({
  cors: { origin: '*' },
  transports: ['websocket'],
});

io.on('connection', (socket) => {
  const auth = socket.handshake.auth;
  const rawIdentity = auth && typeof auth === 'object' && 'identity' in auth
    ? (auth as { identity?: unknown }).identity
    : undefined;

  if (!isDevelopmentIdentity(rawIdentity)) {
    socket.disconnect(true);
    return;
  }

  const identity = rawIdentity;
  socketsByIdentity.get(identity.id)?.disconnect(true);
  socketsByIdentity.set(identity.id, socket);

  socket.on('call:event', (...args: unknown[]) => {
    const [value, rawAck] = args;
    const ack = typeof rawAck === 'function' ? rawAck as Ack : undefined;

    if (!isCallEvent(value) || value.from !== identity.id) {
      ack?.({ ok: false, code: 'invalid-call-event' });
      return;
    }

    const peer = socketsByIdentity.get(value.to);
    if (!peer) {
      ack?.({ ok: false, code: 'peer-offline' });
      return;
    }

    peer.emit('call:event', value);
    ack?.({ ok: true });
  });

  socket.on('disconnect', () => {
    if (socketsByIdentity.get(identity.id) === socket) {
      socketsByIdentity.delete(identity.id);
    }
  });
});

io.listen?.(port);
