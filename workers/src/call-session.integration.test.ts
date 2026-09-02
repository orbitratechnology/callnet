import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import {
  createCallEvent,
  type CallEvent,
} from '../../shared/call-protocol';
import { isServerSignalingMessage } from './protocol';

const profile = {
  username: 'caller',
  displayName: 'Caller',
  photoURL: null,
};

function internalEventRequest(event: CallEvent, sourceUid: string): Request {
  return new Request('https://callnet.internal/event', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Callnet-Internal': 'user-session-event',
      'X-Callnet-Source-Uid': sourceUid,
    },
    body: JSON.stringify(event),
  });
}

async function connectUser(uid: string): Promise<WebSocket> {
  const response = await env.USER_SESSION.getByName(uid).fetch(
    new Request('https://callnet.internal/ws', {
      headers: {
        Upgrade: 'websocket',
        'X-Callnet-User-Id': uid,
        'X-Callnet-Subprotocol': 'callnet.v1',
      },
    }),
  );
  expect(response.status).toBe(101);
  const socket = response.webSocket;
  if (!socket) {
    throw new Error('Expected a WebSocket response.');
  }
  socket.accept();
  return socket;
}

function nextMessage(socket: WebSocket): Promise<unknown> {
  return new Promise((resolve) => {
    socket.addEventListener('message', (event) => {
      resolve(JSON.parse(String(event.data)) as unknown);
    }, { once: true });
  });
}

describe('CallSession Durable Object', () => {
  it('persists a ringing call and relays an invite to the intended UID', async () => {
    const socket = await connectUser('phase3-callee-relay');
    const message = nextMessage(socket);
    const event = createCallEvent({
      type: 'call:invite',
      callId: 'phase3-relay-call',
      from: 'phase3-caller',
      to: 'phase3-callee-relay',
      payload: { kind: 'call', callKind: 'voice', profile },
    });

    const response = await env.CALL_SESSION.getByName(event.callId).fetch(
      internalEventRequest(event, event.from),
    );
    expect(await response.json()).toEqual({ ok: true });

    const value: unknown = await message;
    expect(isServerSignalingMessage(value)).toBe(true);
    if (isServerSignalingMessage(value) && value.kind === 'call:event') {
      expect(value.event).toEqual(event);
    }
    socket.close(1000, 'test complete');
  });

  it('relays accept and end, then treats a duplicate end as idempotent', async () => {
    const callerSocket = await connectUser('phase3-valid-caller');
    const calleeSocket = await connectUser('phase3-valid-callee');
    const callId = 'phase3-valid-call';
    const call = env.CALL_SESSION.getByName(callId);
    const invite = createCallEvent({
      type: 'call:invite',
      callId,
      from: 'phase3-valid-caller',
      to: 'phase3-valid-callee',
      payload: { kind: 'call', callKind: 'video', profile },
    });
    const inviteMessage = nextMessage(calleeSocket);
    expect(await (await call.fetch(internalEventRequest(invite, invite.from))).json()).toEqual({ ok: true });
    await inviteMessage;

    const accept = createCallEvent({
      type: 'call:accept',
      callId,
      from: 'phase3-valid-callee',
      to: 'phase3-valid-caller',
      payload: { kind: 'empty' },
    });
    const acceptMessage = nextMessage(callerSocket);
    expect(await (await call.fetch(internalEventRequest(accept, accept.from))).json()).toEqual({ ok: true });
    await acceptMessage;

    const end = createCallEvent({
      type: 'call:end',
      callId,
      from: 'phase3-valid-caller',
      to: 'phase3-valid-callee',
      payload: { kind: 'empty' },
    });
    const endMessage = nextMessage(calleeSocket);
    expect(await (await call.fetch(internalEventRequest(end, end.from))).json()).toEqual({ ok: true });
    await endMessage;

    expect(await (await call.fetch(internalEventRequest(end, end.from))).json()).toEqual({
      ok: true,
      code: 'already-ended',
    });
    callerSocket.close(1000, 'test complete');
    calleeSocket.close(1000, 'test complete');
  });

  it('rejects an event from a non-participant', async () => {
    const socket = await connectUser('phase3-callee-auth');
    const event = createCallEvent({
      type: 'call:invite',
      callId: 'phase3-auth-call',
      from: 'phase3-caller',
      to: 'phase3-callee-auth',
      payload: { kind: 'call', callKind: 'voice', profile },
    });
    const call = env.CALL_SESSION.getByName(event.callId);

    const inviteResponse = await call.fetch(internalEventRequest(event, event.from));
    expect(await inviteResponse.json()).toEqual({ ok: true });

    const unauthorized = createCallEvent({
      type: 'webrtc:offer',
      callId: event.callId,
      from: 'phase3-attacker',
      to: event.to,
      payload: { kind: 'session-description', type: 'offer', sdp: 'v=0' },
    });
    const response = await call.fetch(internalEventRequest(unauthorized, unauthorized.from));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, code: 'unauthorized-call' });
    socket.close(1000, 'test complete');
  });
});
