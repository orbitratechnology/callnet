import { describe, expect, it, vi } from 'vitest';

import { createCallEvent } from '../../shared/call-protocol';
import {
  createApnsIncomingCallPayload,
  createFcmIncomingCallMessage,
  createIncomingCallPushEvent,
  dispatchOfflineCallInvitePush,
} from './push-dispatch';

const invite = createCallEvent({
  type: 'call:invite',
  callId: 'call-123',
  from: 'caller-uid',
  to: 'callee-uid',
  payload: {
    kind: 'call',
    callKind: 'video',
    profile: {
      phoneNumber: '+15550100001',
      displayName: 'Caller One',
      email: null,
      photoURL: 'https://example.com/avatar.png',
    },
  },
});

describe('push dispatch payloads', () => {
  it('creates the native incoming-call shape with caller identity', () => {
    const value = createIncomingCallPushEvent(invite);

    expect(value).not.toBeNull();
    expect(value).toMatchObject({
      serverCallId: 'call-123',
      hasVideo: true,
      caller: {
        id: 'caller-uid',
        displayName: 'Caller One',
        avatarUrl: 'https://example.com/avatar.png',
      },
      metadata: { phoneNumber: '+15550100001' },
    });
  });

  it('uses the package-compatible APNs and FCM envelopes', () => {
    const event = createIncomingCallPushEvent(invite);
    expect(event).not.toBeNull();

    expect(createApnsIncomingCallPayload(event!)).toEqual({ incomingCall: event });
    expect(createFcmIncomingCallMessage(event!, 'fcm-token')).toEqual({
      message: {
        token: 'fcm-token',
        data: {
          messageType: 'incomingCall',
          incomingCall: JSON.stringify(event),
        },
        android: { priority: 'HIGH' },
      },
    });
  });

  it('does not call an external provider when sender credentials are absent', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await dispatchOfflineCallInvitePush(
      { FIREBASE_PROJECT_ID: 'callnet-test' },
      invite,
    );

    expect(result).toMatchObject({
      delivered: false,
      code: 'push-provider-not-configured',
      attempted: 0,
      succeeded: 0,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
