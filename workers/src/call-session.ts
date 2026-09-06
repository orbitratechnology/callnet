import { DurableObject } from 'cloudflare:workers';
import {
  createCallEvent,
  isCallEvent,
  type CallEvent,
  type CallEventType,
} from '../../shared/call-protocol';
import {
  SIGNALING_PROTOCOL_VERSION,
  type ServerSignalingMessage,
} from './protocol';
import { dispatchOfflineCallInvitePush } from './push-dispatch';
import { redactIdentifier } from '../../shared/diagnostics';

const INTERNAL_EVENT = 'user-session-event';
const INTERNAL_DISCONNECT = 'user-session-disconnect';
const INTERNAL_DELIVERY = 'call-session-delivery';
const MAX_EVENT_SKEW_MS = 5 * 60 * 1_000;
const INVITE_TIMEOUT_MS = 30 * 1_000;
const MAX_REQUEST_BYTES = 512 * 1024;

type CallState = 'ringing' | 'connected';
type TerminalCallEventType = 'call:reject' | 'call:cancel' | 'call:end';

type PersistedCallSession = {
  callId: string;
  callerId: string;
  calleeId: string;
  state: CallState;
  createdAt: number;
  updatedAt: number;
};

type CallSessionResult = {
  ok: boolean;
  code?: string;
};

type DeliveryResult = {
  delivered: boolean;
  code?: string;
};

function jsonResponse(value: CallSessionResult, status = 200): Response {
  return Response.json(value, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isCallSessionResult(value: unknown): value is CallSessionResult {
  return isRecord(value) && typeof value.ok === 'boolean' && (value.code === undefined || typeof value.code === 'string');
}

function isDeliveryResult(value: unknown): value is DeliveryResult {
  return isRecord(value) &&
    typeof value.delivered === 'boolean' &&
    (value.code === undefined || typeof value.code === 'string');
}

function isTerminalEvent(type: CallEventType): type is TerminalCallEventType {
  return type === 'call:reject' || type === 'call:cancel' || type === 'call:end';
}

function isCompatibleEventPayload(event: CallEvent): boolean {
  if (event.type === 'call:invite') {
    return event.payload.kind === 'call';
  }

  if (event.type === 'call:accept' || isTerminalEvent(event.type)) {
    return event.payload.kind === 'empty';
  }

  if (event.type === 'webrtc:offer' || event.type === 'webrtc:answer') {
    return event.payload.kind === 'session-description' && event.payload.type === event.type.slice(7);
  }

  return event.payload.kind === 'ice-candidate';
}

function readSession(ctx: DurableObjectState): PersistedCallSession | null {
  const row = ctx.storage.sql
    .exec<{
      call_id: string;
      caller_id: string;
      callee_id: string;
      state: string;
      created_at: number;
      updated_at: number;
    }>('SELECT call_id, caller_id, callee_id, state, created_at, updated_at FROM call_session LIMIT 1')
    .toArray()[0];

  if (!row || (row.state !== 'ringing' && row.state !== 'connected')) {
    return null;
  }

  return {
    callId: row.call_id,
    callerId: row.caller_id,
    calleeId: row.callee_id,
    state: row.state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function saveSession(ctx: DurableObjectState, session: PersistedCallSession): void {
  ctx.storage.sql.exec(
    `INSERT OR REPLACE INTO call_session
      (call_id, caller_id, callee_id, state, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
    session.callId,
    session.callerId,
    session.calleeId,
    session.state,
    session.createdAt,
    session.updatedAt,
  );
}

function deleteSession(ctx: DurableObjectState): void {
  ctx.storage.sql.exec('DELETE FROM call_session');
}

async function parseEvent(request: Request): Promise<CallEvent | null> {
  const contentLength = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return null;
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(text);
    return isCallEvent(value) ? value : null;
  } catch {
    return null;
  }
}

export class CallSession extends DurableObject<Env> {
  private readonly ready: Promise<void>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ready = ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(
        `CREATE TABLE IF NOT EXISTS call_session (
          call_id TEXT PRIMARY KEY,
          caller_id TEXT NOT NULL,
          callee_id TEXT NOT NULL,
          state TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )`,
      );
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;

    if (request.method !== 'POST') {
      return new Response('Not found.', { status: 404 });
    }

    const pathname = new URL(request.url).pathname;
    if (request.headers.get('X-Callnet-Internal') === INTERNAL_EVENT && pathname === '/event') {
      return this.handleEvent(request);
    }

    if (request.headers.get('X-Callnet-Internal') === INTERNAL_DISCONNECT && pathname === '/disconnect') {
      return this.handleDisconnect(request);
    }

    return new Response('Not found.', { status: 404 });
  }

  async alarm(): Promise<void> {
    await this.ready;
    await this.ctx.blockConcurrencyWhile(async () => {
      const session = readSession(this.ctx);
      if (!session) {
        await this.ctx.storage.deleteAlarm();
        return;
      }

      const deadline = session.createdAt + INVITE_TIMEOUT_MS;
      if (session.state !== 'ringing' || deadline > Date.now()) {
        if (session.state === 'ringing') {
          await this.ctx.storage.setAlarm(deadline);
        } else {
          await this.ctx.storage.deleteAlarm();
        }
        return;
      }

      const timestamp = Date.now();
      await this.deliverEvent(createCallEvent({
        type: 'call:cancel',
        callId: session.callId,
        from: session.callerId,
        to: session.calleeId,
        timestamp,
        payload: { kind: 'empty', reason: 'timed-out' },
      }));
      await this.deliverEvent(createCallEvent({
        type: 'call:cancel',
        callId: session.callId,
        from: session.calleeId,
        to: session.callerId,
        timestamp,
        payload: { kind: 'empty', reason: 'timed-out' },
      }));
      await this.clearUserSnapshots(session);
      deleteSession(this.ctx);
      await this.ctx.storage.deleteAlarm();
    });
  }

  private async handleEvent(request: Request): Promise<Response> {
    const sourceUid = request.headers.get('X-Callnet-Source-Uid');
    const event = await parseEvent(request);
    if (!sourceUid || !event || event.from !== sourceUid || !isCompatibleEventPayload(event)) {
      return jsonResponse({ ok: false, code: 'invalid-call-event' }, 400);
    }

    if (Math.abs(Date.now() - event.timestamp) > MAX_EVENT_SKEW_MS) {
      return jsonResponse({ ok: false, code: 'invalid-call-event' }, 400);
    }

    return this.ctx.blockConcurrencyWhile(() => this.applyEvent(event));
  }

  private async applyEvent(event: CallEvent): Promise<Response> {
    const existing = readSession(this.ctx);

    if (event.type === 'call:invite') {
      if (existing) {
        return existing.callerId === event.from && existing.calleeId === event.to
          ? jsonResponse({ ok: true, code: 'duplicate' })
          : jsonResponse({ ok: false, code: 'unauthorized-call' }, 403);
      }

      const timestamp = Date.now();
      const session: PersistedCallSession = {
        callId: event.callId,
        callerId: event.from,
        calleeId: event.to,
        state: 'ringing',
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      saveSession(this.ctx, session);
      await this.ctx.storage.setAlarm(timestamp + INVITE_TIMEOUT_MS);

      const delivery = await this.deliverEvent(event);
      if (!delivery.delivered) {
        if (delivery.code === 'peer-busy') {
          deleteSession(this.ctx);
          await this.ctx.storage.deleteAlarm();
          return jsonResponse({ ok: false, code: 'peer-busy' }, 409);
        }
        const pushResult = await dispatchOfflineCallInvitePush(this.env, event);
        if (!pushResult.delivered) {
          deleteSession(this.ctx);
          await this.ctx.storage.deleteAlarm();
          return jsonResponse({ ok: false, code: 'peer-offline' }, 409);
        }

        await this.env.USER_SESSION.getByName(event.to).rememberActiveCall(event, event.to);

        console.info(JSON.stringify({
          event: 'call_invite_push_delivered',
          callId: redactIdentifier(event.callId),
          targetUid: redactIdentifier(event.to),
          attempted: pushResult.attempted,
          succeeded: pushResult.succeeded,
        }));
        return jsonResponse({ ok: true, code: 'push-delivered' });
      }

      return jsonResponse({ ok: true });
    }

    if (!existing) {
      return isTerminalEvent(event.type)
        ? jsonResponse({ ok: true, code: 'already-ended' })
        : jsonResponse({ ok: false, code: 'call-not-found' }, 404);
    }

    const isParticipantPair =
      (event.from === existing.callerId && event.to === existing.calleeId) ||
      (event.from === existing.calleeId && event.to === existing.callerId);
    if (!isParticipantPair) {
      return jsonResponse({ ok: false, code: 'unauthorized-call' }, 403);
    }

    if (event.type === 'call:accept') {
      if (existing.state === 'connected') {
        return jsonResponse({ ok: true, code: 'already-accepted' });
      }
      if (event.from !== existing.calleeId) {
        return jsonResponse({ ok: false, code: 'invalid-call-state' }, 409);
      }

      const connected = { ...existing, state: 'connected' as const, updatedAt: Date.now() };
      saveSession(this.ctx, connected);
      if (!(await this.deliverEvent(event)).delivered) {
        saveSession(this.ctx, existing);
        return jsonResponse({ ok: false, code: 'peer-offline' }, 409);
      }
      return jsonResponse({ ok: true });
    }

    if (isTerminalEvent(event.type)) {
      if (
        (event.type === 'call:reject' && (existing.state !== 'ringing' || event.from !== existing.calleeId)) ||
        (event.type === 'call:cancel' && event.from !== existing.callerId)
      ) {
        return jsonResponse({ ok: false, code: 'invalid-call-state' }, 409);
      }

      const delivery = await this.deliverEvent(event);
      await this.clearUserSnapshots(existing);
      deleteSession(this.ctx);
      await this.ctx.storage.deleteAlarm();
      return jsonResponse({ ok: true, ...(delivery.delivered ? {} : { code: 'peer-offline' }) });
    }

    if (event.type === 'webrtc:offer' && event.from !== existing.callerId) {
      return jsonResponse({ ok: false, code: 'invalid-call-state' }, 409);
    }
    if (event.type === 'webrtc:answer' && (existing.state !== 'connected' || event.from !== existing.calleeId)) {
      return jsonResponse({ ok: false, code: 'invalid-call-state' }, 409);
    }

    const delivery = await this.deliverEvent(event);
    return delivery.delivered
      ? jsonResponse({ ok: true })
      : jsonResponse({ ok: false, code: 'peer-offline' }, 409);
  }

  private async handleDisconnect(request: Request): Promise<Response> {
    const sourceUid = request.headers.get('X-Callnet-Source-Uid');
    if (!sourceUid) {
      return jsonResponse({ ok: false, code: 'invalid-call-event' }, 400);
    }

    return this.ctx.blockConcurrencyWhile(async () => {
      const session = readSession(this.ctx);
      if (!session) {
        return jsonResponse({ ok: true, code: 'already-ended' });
      }

      if (sourceUid !== session.callerId && sourceUid !== session.calleeId) {
        return jsonResponse({ ok: false, code: 'unauthorized-call' }, 403);
      }

      const peerId = sourceUid === session.callerId ? session.calleeId : session.callerId;
      await this.deliverEvent(createCallEvent({
        type: 'call:end',
        callId: session.callId,
        from: sourceUid,
        to: peerId,
        payload: { kind: 'empty' },
      }));
      await this.clearUserSnapshots(session);
      deleteSession(this.ctx);
      await this.ctx.storage.deleteAlarm();
      return jsonResponse({ ok: true });
    });
  }

  private async deliverEvent(event: CallEvent): Promise<DeliveryResult> {
    const message: ServerSignalingMessage = {
      version: SIGNALING_PROTOCOL_VERSION,
      kind: 'call:event',
      event,
    };
    const response = await this.env.USER_SESSION.getByName(event.to).fetch(
      new Request('https://callnet.internal/deliver', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Callnet-Internal': INTERNAL_DELIVERY,
          'X-Callnet-Target-Uid': event.to,
        },
        body: JSON.stringify(message),
      }),
    );

    if (!response.ok) {
      return { delivered: false };
    }

    try {
      const value: unknown = await response.json();
      return isDeliveryResult(value) ? value : { delivered: false };
    } catch {
      return { delivered: false };
    }
  }

  private async clearUserSnapshots(session: PersistedCallSession): Promise<void> {
    await Promise.all([
      this.env.USER_SESSION.getByName(session.callerId).forgetActiveCall(session.callId),
      this.env.USER_SESSION.getByName(session.calleeId).forgetActiveCall(session.callId),
    ]);
  }
}
