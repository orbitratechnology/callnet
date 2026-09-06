export const CALL_PROTOCOL_VERSION = 2 as const;

export type CallIdentityId = string;
export type CallIdentity = {
  mode: 'firebase';
  uid: CallIdentityId;
};

export type CallKind = 'voice' | 'video';
export type CallTerminationReason = 'cancelled' | 'timed-out';
export type CallProfile = {
  username: string;
  displayName: string;
  photoURL: string | null;
};

export type ActiveCallSnapshot = {
  callId: string;
  peerId: CallIdentityId;
  kind: CallKind;
  direction: 'incoming' | 'outgoing';
  state: 'ringing' | 'connected';
  createdAt: number;
  updatedAt: number;
};

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
  | { kind: 'call'; callKind: CallKind; profile: CallProfile }
  | { kind: 'empty'; reason?: CallTerminationReason }
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
  from: CallIdentityId;
  to: CallIdentityId;
  timestamp: number;
  payload: CallSignalPayload;
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

function isCallIdentityId(value: unknown): value is CallIdentityId {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

function isCallKind(value: unknown): value is CallKind {
  return value === 'voice' || value === 'video';
}

function isCallProfile(value: unknown): value is CallProfile {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.username === 'string' &&
    /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/.test(value.username) &&
    typeof value.displayName === 'string' &&
    value.displayName.length >= 1 &&
    value.displayName.length <= 80 &&
    (value.photoURL === null || (typeof value.photoURL === 'string' && value.photoURL.length <= 2048))
  );
}

function isSignalPayload(value: unknown): value is CallSignalPayload {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return false;
  }

  if (value.kind === 'call') {
    return isCallKind(value.callKind) && isCallProfile(value.profile);
  }

  if (value.kind === 'empty') {
    return value.reason === undefined || value.reason === 'cancelled' || value.reason === 'timed-out';
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
    isCallIdentityId(value.from) &&
    isCallIdentityId(value.to) &&
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

export function isCallIdentity(value: unknown): value is CallIdentity {
  return isRecord(value) && value.mode === 'firebase' && isCallIdentityId(value.uid);
}
