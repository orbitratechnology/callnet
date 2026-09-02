import {
  isCallEvent,
  type CallEvent,
} from './call-protocol';

export const SIGNALING_PROTOCOL_VERSION = 2 as const;
export const SIGNALING_SUBPROTOCOL = 'callnet.v1' as const;
export const MAX_SIGNALING_MESSAGE_BYTES = 512 * 1024;

export type ClientSignalingMessage = {
  version: typeof SIGNALING_PROTOCOL_VERSION;
  kind: 'call:event';
  requestId: string;
  event: CallEvent;
};

export type ServerSignalingMessage =
  | {
      version: typeof SIGNALING_PROTOCOL_VERSION;
      kind: 'call:event';
      event: CallEvent;
    }
  | {
      version: typeof SIGNALING_PROTOCOL_VERSION;
      kind: 'ack';
      requestId: string;
      ok: boolean;
      code?: string;
    }
  | {
      version: typeof SIGNALING_PROTOCOL_VERSION;
      kind: 'error';
      code: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isRequestId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function isCode(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9-]{1,64}$/.test(value);
}

export function isClientSignalingMessage(value: unknown): value is ClientSignalingMessage {
  return (
    isRecord(value) &&
    value.version === SIGNALING_PROTOCOL_VERSION &&
    value.kind === 'call:event' &&
    isRequestId(value.requestId) &&
    isCallEvent(value.event)
  );
}

export function isServerSignalingMessage(value: unknown): value is ServerSignalingMessage {
  if (!isRecord(value) || value.version !== SIGNALING_PROTOCOL_VERSION) {
    return false;
  }

  if (value.kind === 'call:event') {
    return isCallEvent(value.event);
  }

  if (value.kind === 'ack') {
    return (
      isRequestId(value.requestId) &&
      typeof value.ok === 'boolean' &&
      (value.code === undefined || isCode(value.code))
    );
  }

  return value.kind === 'error' && isCode(value.code);
}

export function createClientSignalingMessage(
  requestId: string,
  event: CallEvent,
): ClientSignalingMessage {
  if (!isRequestId(requestId)) {
    throw new Error('Invalid signaling request ID.');
  }

  return {
    version: SIGNALING_PROTOCOL_VERSION,
    kind: 'call:event',
    requestId,
    event,
  };
}
