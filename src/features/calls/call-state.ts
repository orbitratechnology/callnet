import type { DemoPerson } from '../contacts/demo-people';

export type CallKind = 'voice' | 'video';
export type CallDirection = 'incoming' | 'outgoing';
export type CallState =
  | 'idle'
  | 'outgoing'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'ending'
  | 'ended'
  | 'failed';

export type CallSession = {
  callId: string;
  kind: CallKind;
  direction: CallDirection;
  person: DemoPerson;
  state: CallState;
  startedAt: number;
  connectedAt?: number;
  endedAt?: number;
  failureReason?: string;
  isMuted: boolean;
  isSpeakerEnabled: boolean;
  isCameraEnabled: boolean;
  isFrontCamera: boolean;
};

export type CallAction =
  | { type: 'start'; session: CallSession }
  | { type: 'transition'; state: CallState; at?: number; failureReason?: string }
  | { type: 'toggle-mute' }
  | { type: 'toggle-speaker' }
  | { type: 'toggle-camera' }
  | { type: 'switch-camera' }
  | { type: 'reset' };

const validTransitions: Record<CallState, readonly CallState[]> = {
  idle: ['outgoing', 'ringing'],
  outgoing: ['ringing', 'connecting', 'ending', 'ended', 'failed'],
  ringing: ['connecting', 'ending', 'ended', 'failed'],
  connecting: ['connected', 'ending', 'ended', 'failed'],
  connected: ['ending', 'ended', 'failed'],
  ending: ['ended', 'failed'],
  ended: ['idle'],
  failed: ['idle'],
};

export function canTransitionCallState(from: CallState, to: CallState) {
  return validTransitions[from].includes(to);
}

export function createCallSession(
  person: DemoPerson,
  kind: CallKind,
  direction: CallDirection,
  now = Date.now(),
  callId = `call-${now}-${person.id}`,
): CallSession {
  return {
    callId,
    kind,
    direction,
    person,
    state: direction === 'incoming' ? 'ringing' : 'outgoing',
    startedAt: now,
    isMuted: false,
    isSpeakerEnabled: false,
    isCameraEnabled: kind === 'video',
    isFrontCamera: true,
  };
}

export function callReducer(
  session: CallSession | null,
  action: CallAction,
): CallSession | null {
  if (action.type === 'start') {
    return session === null || session.state === 'ended' || session.state === 'failed'
      ? action.session
      : session;
  }

  if (action.type === 'reset') {
    return session?.state === 'ended' || session?.state === 'failed' ? null : session;
  }

  if (session === null) {
    return null;
  }

  if (action.type === 'transition') {
    if (!canTransitionCallState(session.state, action.state)) {
      return session;
    }

    return {
      ...session,
      state: action.state,
      connectedAt: action.state === 'connected' ? action.at ?? Date.now() : session.connectedAt,
      endedAt:
        action.state === 'ended' || action.state === 'failed'
          ? action.at ?? Date.now()
          : session.endedAt,
      failureReason: action.failureReason,
    };
  }

  if (action.type === 'toggle-mute') {
    return { ...session, isMuted: !session.isMuted };
  }

  if (action.type === 'toggle-speaker') {
    return { ...session, isSpeakerEnabled: !session.isSpeakerEnabled };
  }

  if (action.type === 'toggle-camera') {
    return { ...session, isCameraEnabled: !session.isCameraEnabled };
  }

  return { ...session, isFrontCamera: !session.isFrontCamera };
}
