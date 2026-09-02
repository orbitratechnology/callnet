import type { CallEvent, CallEventType } from '../shared/call-protocol';

export type CallSession = {
  callId: string;
  callerId: string;
  calleeId: string;
  state: 'ringing' | 'connected';
};

export type CallEventDecision =
  | { ok: true; relay: boolean; code?: 'duplicate' | 'already-accepted' | 'already-ended' }
  | { ok: false; code: 'busy' | 'call-not-found' | 'invalid-call-state' | 'unauthorized-call' };

const terminalEvents = new Set<CallEventType>(['call:reject', 'call:cancel', 'call:end']);

export class CallSessionRegistry {
  private readonly sessions = new Map<string, CallSession>();
  private readonly activeCallByUser = new Map<string, string>();

  apply(event: CallEvent): CallEventDecision {
    if (event.type === 'call:invite') {
      return this.applyInvite(event);
    }

    const session = this.sessions.get(event.callId);
    if (!session) {
      return terminalEvents.has(event.type)
        ? { ok: true, relay: false, code: 'already-ended' }
        : { ok: false, code: 'call-not-found' };
    }

    if (!this.isParticipantPair(session, event)) {
      return { ok: false, code: 'unauthorized-call' };
    }

    if (event.type === 'call:accept') {
      if (session.state === 'connected') {
        return { ok: true, relay: false, code: 'already-accepted' };
      }
      if (event.from !== session.calleeId) {
        return { ok: false, code: 'invalid-call-state' };
      }
      session.state = 'connected';
      return { ok: true, relay: true };
    }

    if (terminalEvents.has(event.type)) {
      this.remove(session);
      return { ok: true, relay: true };
    }

    if (event.type === 'webrtc:offer' && event.from !== session.callerId) {
      return { ok: false, code: 'invalid-call-state' };
    }
    if (event.type === 'webrtc:answer' && event.from !== session.calleeId) {
      return { ok: false, code: 'invalid-call-state' };
    }

    return { ok: true, relay: true };
  }

  closeForUser(userId: string) {
    const callId = this.activeCallByUser.get(userId);
    if (!callId) {
      return null;
    }

    const session = this.sessions.get(callId) ?? null;
    if (session) {
      this.remove(session);
    } else {
      this.activeCallByUser.delete(userId);
    }
    return session;
  }

  private applyInvite(event: CallEvent): CallEventDecision {
    const existing = this.sessions.get(event.callId);
    if (existing) {
      return this.isParticipantPair(existing, event)
        ? { ok: true, relay: false, code: 'duplicate' }
        : { ok: false, code: 'unauthorized-call' };
    }

    if (this.activeCallByUser.has(event.from) || this.activeCallByUser.has(event.to)) {
      return { ok: false, code: 'busy' };
    }

    const session: CallSession = {
      callId: event.callId,
      callerId: event.from,
      calleeId: event.to,
      state: 'ringing',
    };
    this.sessions.set(session.callId, session);
    this.activeCallByUser.set(session.callerId, session.callId);
    this.activeCallByUser.set(session.calleeId, session.callId);
    return { ok: true, relay: true };
  }

  private isParticipantPair(session: CallSession, event: CallEvent) {
    return (
      (event.from === session.callerId && event.to === session.calleeId) ||
      (event.from === session.calleeId && event.to === session.callerId)
    );
  }

  private remove(session: CallSession) {
    this.sessions.delete(session.callId);
    if (this.activeCallByUser.get(session.callerId) === session.callId) {
      this.activeCallByUser.delete(session.callerId);
    }
    if (this.activeCallByUser.get(session.calleeId) === session.callId) {
      this.activeCallByUser.delete(session.calleeId);
    }
  }
}
