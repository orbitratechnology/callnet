export const CALL_PROTOCOL_VERSION = 1 as const;

export const DEVELOPMENT_IDENTITY_IDS = ['device-a', 'device-b'] as const;
export type DevelopmentIdentityId = (typeof DEVELOPMENT_IDENTITY_IDS)[number];

export type CallKind = 'voice' | 'video';

export type CallEventType =
  | 'call:invite'
  | 'call:accept'
  | 'call:reject'
  | 'call:cancel'
  | 'call:end'
  | 'webrtc:offer'
  | 'webrtc:answer'
  | 'webrtc:ice-candidate';

export type CallSignalPayload =
  | { kind: 'call'; callKind: CallKind }
  | { kind: 'empty' }
  | { kind: 'session-description'; type: 'offer' | 'answer'; sdp: string }
  | {
      kind: 'ice-candidate';
      candidate: string | null;
      sdpMid?: string | null;
      sdpMLineIndex?: number | null;
    };

export type CallEvent = {
  version: typeof CALL_PROTOCOL_VERSION;
  type: CallEventType;
  callId: string;
  from: DevelopmentIdentityId;
  to: DevelopmentIdentityId;
  timestamp: number;
  payload: CallSignalPayload;
};

export type DevelopmentIdentity = {
  mode: 'development';
  id: DevelopmentIdentityId;
};

const callEventTypes = new Set<CallEventType>([
  'call:invite',
  'call:accept',
  'call:reject',
  'call:cancel',
  'call:end',
  'webrtc:offer',
  'webrtc:answer',
  'webrtc:ice-candidate',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isDevelopmentIdentityId(value: unknown): value is DevelopmentIdentityId {
  return value === 'device-a' || value === 'device-b';
}

function isCallKind(value: unknown): value is CallKind {
  return value === 'voice' || value === 'video';
}

function isSignalPayload(value: unknown): value is CallSignalPayload {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return false;
  }

  if (value.kind === 'call') {
    return isCallKind(value.callKind);
  }

  if (value.kind === 'empty') {
    return true;
  }

  if (value.kind === 'session-description') {
    return (
      (value.type === 'offer' || value.type === 'answer') &&
      typeof value.sdp === 'string' &&
      value.sdp.length > 0 &&
      value.sdp.length <= 200_000
    );
  }

  return (
    value.kind === 'ice-candidate' &&
    (typeof value.candidate === 'string' || value.candidate === null) &&
    (value.sdpMid === undefined || value.sdpMid === null || typeof value.sdpMid === 'string') &&
    (value.sdpMLineIndex === undefined ||
      value.sdpMLineIndex === null ||
      (typeof value.sdpMLineIndex === 'number' && Number.isInteger(value.sdpMLineIndex)))
  );
}

export function isCallEvent(value: unknown): value is CallEvent {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === CALL_PROTOCOL_VERSION &&
    typeof value.type === 'string' &&
    callEventTypes.has(value.type as CallEventType) &&
    typeof value.callId === 'string' &&
    value.callId.length > 0 &&
    value.callId.length <= 128 &&
    isDevelopmentIdentityId(value.from) &&
    isDevelopmentIdentityId(value.to) &&
    value.from !== value.to &&
    typeof value.timestamp === 'number' &&
    Number.isFinite(value.timestamp) &&
    isSignalPayload(value.payload)
  );
}

export function createCallEvent(input: Omit<CallEvent, 'version' | 'timestamp'> & { timestamp?: number }): CallEvent {
  return {
    ...input,
    version: CALL_PROTOCOL_VERSION,
    timestamp: input.timestamp ?? Date.now(),
  };
}

export function isDevelopmentIdentity(value: unknown): value is DevelopmentIdentity {
  return isRecord(value) && value.mode === 'development' && isDevelopmentIdentityId(value.id);
}
