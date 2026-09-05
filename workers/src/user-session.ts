import { DurableObject } from 'cloudflare:workers';
import { isCallEvent, type CallEvent } from '../../shared/call-protocol';
import {
  isClientSignalingMessage,
  isServerSignalingMessage,
  MAX_SIGNALING_MESSAGE_BYTES,
  SIGNALING_PROTOCOL_VERSION,
  SIGNALING_SUBPROTOCOL,
  type ClientSignalingMessage,
  type ServerSignalingMessage,
} from './protocol';

const WEBSOCKET_UPGRADE = 'websocket';
const INTERNAL_DELIVERY = 'call-session-delivery';
const INTERNAL_DISCONNECT = 'user-session-disconnect';
const MAX_EVENT_SKEW_MS = 5 * 60 * 1_000;

type UserSessionAttachment = {
  uid: string;
};

type CallSessionResult = {
  ok: boolean;
  code?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isUserSessionAttachment(value: unknown): value is UserSessionAttachment {
  return isRecord(value) && typeof value.uid === 'string' && value.uid.length > 0;
}

function isCallSessionResult(value: unknown): value is CallSessionResult {
  return isRecord(value) && typeof value.ok === 'boolean' && (value.code === undefined || typeof value.code === 'string');
}

function decodeMessage(message: string | ArrayBuffer): string | null {
  const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
  return new TextEncoder().encode(text).byteLength <= MAX_SIGNALING_MESSAGE_BYTES ? text : null;
}

function parseClientMessage(message: string | ArrayBuffer): ClientSignalingMessage | null {
  const text = decodeMessage(message);
  if (!text) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(text);
    return isClientSignalingMessage(value) ? value : null;
  } catch {
    return null;
  }
}

function isTerminalCallEvent(event: CallEvent): boolean {
  return event.type === 'call:reject' || event.type === 'call:cancel' || event.type === 'call:end';
}

export class UserSession extends DurableObject<Env> {
  private readonly ready: Promise<void>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ready = ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(
        `CREATE TABLE IF NOT EXISTS active_call (
          call_id TEXT PRIMARY KEY
        )`,
      );
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;

    if (request.headers.get('X-Callnet-Internal') === INTERNAL_DELIVERY) {
      return this.deliverToSockets(request);
    }

    if (
      request.method !== 'GET' ||
      request.headers.get('Upgrade')?.toLowerCase() !== WEBSOCKET_UPGRADE
    ) {
      return new Response('WebSocket upgrade required.', { status: 426 });
    }

    const uid = request.headers.get('X-Callnet-User-Id');
    if (!uid || request.headers.get('X-Callnet-Subprotocol') !== SIGNALING_SUBPROTOCOL) {
      return new Response('Unauthorized.', { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ uid } satisfies UserSessionAttachment);

    return new Response(null, {
      status: 101,
      headers: { 'Sec-WebSocket-Protocol': SIGNALING_SUBPROTOCOL },
      webSocket: client,
    });
  }

  async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.ready;
    const attachment = webSocket.deserializeAttachment();
    const parsed = parseClientMessage(message);
    if (!isUserSessionAttachment(attachment) || !parsed) {
      this.sendMessage(webSocket, { version: SIGNALING_PROTOCOL_VERSION, kind: 'error', code: 'invalid-message' });
      return;
    }

    const event = parsed.event;
    if (
      !isCallEvent(event) ||
      event.from !== attachment.uid ||
      Math.abs(Date.now() - event.timestamp) > MAX_EVENT_SKEW_MS
    ) {
      this.sendMessage(webSocket, {
        version: SIGNALING_PROTOCOL_VERSION,
        kind: 'ack',
        requestId: parsed.requestId,
        ok: false,
        code: 'invalid-call-event',
      });
      return;
    }

    let result: CallSessionResult;
    try {
      const response = await this.env.CALL_SESSION.getByName(event.callId).fetch(
        new Request('https://callnet.internal/event', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Callnet-Internal': 'user-session-event',
            'X-Callnet-Source-Uid': attachment.uid,
          },
          body: JSON.stringify(event),
        }),
      );
      const value: unknown = await response.json();
      result = isCallSessionResult(value)
        ? value
        : { ok: false, code: 'call-session-unavailable' };
    } catch {
      result = { ok: false, code: 'call-session-unavailable' };
    }

    if (result.ok) {
      if (isTerminalCallEvent(event) || result.code === 'already-ended') {
        this.forgetCall(event.callId);
      } else {
        this.rememberCall(event.callId);
      }
    }

    this.sendMessage(webSocket, {
      version: SIGNALING_PROTOCOL_VERSION,
      kind: 'ack',
      requestId: parsed.requestId,
      ok: result.ok,
      ...(result.code ? { code: result.code } : {}),
    });
  }

  async webSocketClose(webSocket: WebSocket, code: number, reason: string): Promise<void> {
    webSocket.close(code, reason);
    await this.ready;
    const hasOpenPeer = this.ctx.getWebSockets().some((socket) => socket.readyState === 1);
    if (hasOpenPeer) {
      return;
    }

    const uid = this.getUid(webSocket);
    if (!uid) {
      return;
    }

    const activeCalls = this.ctx.storage.sql
      .exec<{ call_id: string }>('SELECT call_id FROM active_call')
      .toArray()
      .map((row) => row.call_id);
    await Promise.all(activeCalls.map((callId) =>
      this.env.CALL_SESSION.getByName(callId).fetch(
        new Request('https://callnet.internal/disconnect', {
          method: 'POST',
          headers: {
            'X-Callnet-Internal': INTERNAL_DISCONNECT,
            'X-Callnet-Source-Uid': uid,
          },
        }),
      ).catch(() => undefined),
    ));
    this.ctx.storage.sql.exec('DELETE FROM active_call');
  }

  async webSocketError(_webSocket: WebSocket, _error: unknown): Promise<void> {
    // The platform closes errored sockets and invokes webSocketClose.
  }

  private async deliverToSockets(request: Request): Promise<Response> {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/deliver') {
      return new Response('Not found.', { status: 404 });
    }

    const targetUid = request.headers.get('X-Callnet-Target-Uid');
    const text = await request.text();
    if (!targetUid || new TextEncoder().encode(text).byteLength > MAX_SIGNALING_MESSAGE_BYTES) {
      return Response.json({ delivered: false }, { status: 400 });
    }

    return this.ctx.blockConcurrencyWhile(async () => {
      try {
        const value: unknown = JSON.parse(text);
        if (!isServerSignalingMessage(value) || value.kind !== 'call:event' || value.event.to !== targetUid) {
          return Response.json({ delivered: false }, { status: 400 });
        }

        if (value.event.type === 'call:invite' && this.hasOtherActiveCall(value.event.callId)) {
          return Response.json({ delivered: false, code: 'peer-busy' }, { status: 409 });
        }

        const sockets = this.ctx.getWebSockets().filter((socket) => socket.readyState === 1);
        if (sockets.length === 0) {
          return Response.json({ delivered: false }, { status: 404 });
        }

        const frame = JSON.stringify(value);
        sockets.forEach((socket) => socket.send(frame));
        if (isTerminalCallEvent(value.event)) {
          this.forgetCall(value.event.callId);
        } else {
          this.rememberCall(value.event.callId);
        }
        return Response.json({ delivered: true });
      } catch {
        return Response.json({ delivered: false }, { status: 400 });
      }
    });
  }

  private getUid(webSocket: WebSocket): string | null {
    const attachment = webSocket.deserializeAttachment();
    return isUserSessionAttachment(attachment) ? attachment.uid : null;
  }

  private sendMessage(webSocket: WebSocket, message: ServerSignalingMessage): void {
    if (webSocket.readyState === 1) {
      webSocket.send(JSON.stringify(message));
    }
  }

  private rememberCall(callId: string): void {
    this.ctx.storage.sql.exec('INSERT OR IGNORE INTO active_call (call_id) VALUES (?)', callId);
  }

  private hasOtherActiveCall(callId: string): boolean {
    return this.ctx.storage.sql
      .exec<{ call_id: string }>('SELECT call_id FROM active_call WHERE call_id != ? LIMIT 1', callId)
      .toArray().length > 0;
  }

  private forgetCall(callId: string): void {
    this.ctx.storage.sql.exec('DELETE FROM active_call WHERE call_id = ?', callId);
  }
}
