import { Platform } from 'react-native';

import type { CallKind, CallProfile } from '../../../shared/call-protocol';

type NativeEventSubscription = {
  remove(): void;
};

type NativeCallParticipant = {
  id: string;
  displayName?: string;
  avatarUrl?: string;
  email?: string;
};

type NativeIncomingCallEvent = {
  eventId: string;
  serverCallId: string;
  caller: NativeCallParticipant;
  hasVideo: boolean;
  startedAt?: string;
  metadata?: Record<string, string>;
};

type NativeCallSession = {
  id: string;
  options?: { hasVideo?: boolean };
  remoteParticipants?: NativeCallParticipant[];
  incomingCallEvent?: NativeIncomingCallEvent;
  status?: string;
};

type NativeCallKitModule = {
  startOutgoingCall(
    recipient: NativeCallParticipant,
    options: { hasVideo: boolean },
  ): Promise<string>;
  answerCall(id: string): Promise<void>;
  endCall(id: string): Promise<void>;
  setMuted(id: string, muted: boolean): Promise<void>;
  reportIncomingCall(event: NativeIncomingCallEvent): Promise<void>;
  reportOutgoingCallConnected(id: string): Promise<void>;
  reportCallEnded(id: string, reason: 'remoteEnded' | 'failed'): Promise<void>;
  reportVideo(id: string, enabled: boolean): Promise<void>;
  fulfillIncomingCallConnected(requestId: string): Promise<void>;
  failIncomingCallConnected(id: string, requestId: string): Promise<void>;
  getActiveCallSession(): Promise<NativeCallSession | null>;
  registerVoIPPush(): void;
  getVoIPPushToken(): { token: string; type: 'APNS_VOIP' | 'FCM' } | null;
  addIncomingCallReportedListener?(listener: (event: { id: string; session?: NativeCallSession }) => void): NativeEventSubscription;
  addCallAnsweredListener?(listener: (event: { id: string; requestId: string }) => void): NativeEventSubscription;
  addCallEndedListener?(listener: (event: { id: string; session: NativeCallSession }) => void): NativeEventSubscription;
  addSetMutedActionListener?(listener: (event: { id: string; isMuted: boolean }) => void): NativeEventSubscription;
  addVideoChangedListener?(listener: (event: { id: string; hasVideo: boolean }) => void): NativeEventSubscription;
  addVoIPPushTokenUpdatedListener?(listener: (event: { token?: string; type: 'APNS_VOIP' | 'FCM' }) => void): NativeEventSubscription;
};

export type VoipPushToken = {
  token: string;
  type: 'APNS_VOIP' | 'FCM';
};

export type NativeCallUiIncomingCall = {
  serverCallId: string;
  nativeCallId: string;
  peerId: string;
  kind: CallKind;
  profile: CallProfile;
  timestamp: number;
};

export type NativeCallUiEvent =
  | {
      type: 'answered';
      nativeCallId: string;
      serverCallId?: string;
      requestId: string;
    }
  | {
      type: 'ended';
      nativeCallId: string;
      serverCallId?: string;
    }
  | {
      type: 'muted';
      nativeCallId: string;
      muted: boolean;
    }
  | {
      type: 'video-changed';
      nativeCallId: string;
      hasVideo: boolean;
    };

export type NativeCallUi = {
  initialize(): void;
  subscribe(listener: (event: NativeCallUiEvent) => void): () => void;
  startOutgoing(callId: string, peerId: string, profile: CallProfile, kind: CallKind): Promise<void>;
  reportIncoming(callId: string, peerId: string, profile: CallProfile, kind: CallKind, timestamp: number): Promise<void>;
  getActiveIncomingCall(): Promise<NativeCallUiIncomingCall | null>;
  answerIncoming(callId: string): Promise<void>;
  reportConnected(callId: string, direction: 'incoming' | 'outgoing', requestId?: string): Promise<void>;
  failIncoming(callId: string, requestId: string): Promise<void>;
  end(callId: string): Promise<void>;
  reportEnded(callId: string, reason: 'remoteEnded' | 'failed'): Promise<void>;
  setMuted(callId: string, muted: boolean): Promise<void>;
  reportVideo(callId: string, enabled: boolean): Promise<void>;
  registerVoipPush(): void;
  getVoipPushToken(): VoipPushToken | null;
  subscribeVoipPushToken(listener: (token: VoipPushToken | null) => void): () => void;
};

declare const require: (moduleName: string) => unknown;

function unwrapDefault<T>(value: unknown): T {
  if (value && typeof value === 'object' && 'default' in value) {
    return (value as { default: T }).default;
  }

  return value as T;
}

function createNativeEventId() {
  const crypto = unwrapDefault<{ randomUUID?: () => string }>(require('expo-crypto'));
  const eventId = crypto.randomUUID?.();
  if (!eventId) {
    throw new Error('native-call-event-id-unavailable');
  }
  return eventId;
}

function loadNativeModule(): NativeCallKitModule | null {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    const module = unwrapDefault<NativeCallKitModule>(require('expo-callkit-telecom'));
    return module && typeof module.getActiveCallSession === 'function' ? module : null;
  } catch {
    return null;
  }
}

function isProfileUsername(value: string) {
  return /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/.test(value);
}

function getMetadataValue(metadata: Record<string, string> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

class NativeCallUiAdapter implements NativeCallUi {
  private readonly listeners = new Set<(event: NativeCallUiEvent) => void>();
  private readonly serverToNative = new Map<string, string>();
  private readonly nativeToServer = new Map<string, string>();
  private nativeModule: NativeCallKitModule | null | undefined;
  private subscriptions: NativeEventSubscription[] = [];
  private initialized = false;

  initialize() {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.nativeModule = loadNativeModule();
    const module = this.nativeModule;
    if (!module) {
      return;
    }

    if (module.addIncomingCallReportedListener) {
      this.subscriptions.push(module.addIncomingCallReportedListener(({ session }) => {
        this.captureSession(session);
      }));
    }
    if (module.addCallAnsweredListener) {
      this.subscriptions.push(module.addCallAnsweredListener((event) => {
        void this.resolveServerCallId(event.id).then((serverCallId) => {
          this.emit({ type: 'answered', nativeCallId: event.id, serverCallId, requestId: event.requestId });
        });
      }));
    }
    if (module.addCallEndedListener) {
      this.subscriptions.push(module.addCallEndedListener((event) => {
        const serverCallId = this.captureSession(event.session) ?? this.nativeToServer.get(event.id);
        this.emit({ type: 'ended', nativeCallId: event.id, serverCallId });
        if (serverCallId) {
          this.removeMapping(serverCallId);
        }
      }));
    }
    if (module.addSetMutedActionListener) {
      this.subscriptions.push(module.addSetMutedActionListener((event) => {
        this.emit({ type: 'muted', nativeCallId: event.id, muted: event.isMuted });
      }));
    }
    if (module.addVideoChangedListener) {
      this.subscriptions.push(module.addVideoChangedListener((event) => {
        this.emit({ type: 'video-changed', nativeCallId: event.id, hasVideo: event.hasVideo });
      }));
    }
  }

  subscribe(listener: (event: NativeCallUiEvent) => void) {
    this.initialize();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async startOutgoing(callId: string, peerId: string, profile: CallProfile, kind: CallKind) {
    const module = this.getModule();
    if (!module) {
      return;
    }

    const nativeCallId = await module.startOutgoingCall(
      {
        id: peerId,
        displayName: profile.displayName,
        avatarUrl: profile.photoURL ?? undefined,
      },
      { hasVideo: kind === 'video' },
    );
    this.setMapping(callId, nativeCallId);
  }

  async reportIncoming(callId: string, peerId: string, profile: CallProfile, kind: CallKind, timestamp: number) {
    const module = this.getModule();
    if (!module) {
      return;
    }

    await module.reportIncomingCall({
      eventId: createNativeEventId(),
      serverCallId: callId,
      caller: {
        id: peerId,
        displayName: profile.displayName,
        avatarUrl: profile.photoURL ?? undefined,
      },
      hasVideo: kind === 'video',
      startedAt: new Date(timestamp).toISOString(),
      metadata: {
        username: profile.username,
      },
    });

    const session = await module.getActiveCallSession();
    this.captureSession(session);
  }

  async getActiveIncomingCall() {
    const module = this.getModule();
    if (!module) {
      return null;
    }

    const session = await module.getActiveCallSession();
    this.captureSession(session);
    return this.toIncomingCall(session);
  }

  async answerIncoming(callId: string) {
    const module = this.getModule();
    const nativeCallId = await this.resolveNativeCallId(callId);
    if (module && nativeCallId) {
      await module.answerCall(nativeCallId);
    }
  }

  async reportConnected(callId: string, direction: 'incoming' | 'outgoing', requestId?: string) {
    const module = this.getModule();
    if (!module) {
      return;
    }

    if (direction === 'incoming') {
      if (requestId) {
        await module.fulfillIncomingCallConnected(requestId);
      }
      return;
    }

    const nativeCallId = await this.resolveNativeCallId(callId);
    if (nativeCallId) {
      await module.reportOutgoingCallConnected(nativeCallId);
    }
  }

  async failIncoming(callId: string, requestId: string) {
    const module = this.getModule();
    const nativeCallId = await this.resolveNativeCallId(callId);
    if (module && nativeCallId) {
      await module.failIncomingCallConnected(nativeCallId, requestId);
    }
  }

  async end(callId: string) {
    const module = this.getModule();
    const nativeCallId = await this.resolveNativeCallId(callId);
    if (module && nativeCallId) {
      await module.endCall(nativeCallId);
    }
  }

  async reportEnded(callId: string, reason: 'remoteEnded' | 'failed') {
    const module = this.getModule();
    const nativeCallId = await this.resolveNativeCallId(callId);
    if (module && nativeCallId) {
      await module.reportCallEnded(nativeCallId, reason);
    }
    this.removeMapping(callId);
  }

  async setMuted(callId: string, muted: boolean) {
    const module = this.getModule();
    const nativeCallId = await this.resolveNativeCallId(callId);
    if (module && nativeCallId) {
      await module.setMuted(nativeCallId, muted);
    }
  }

  async reportVideo(callId: string, enabled: boolean) {
    const module = this.getModule();
    const nativeCallId = await this.resolveNativeCallId(callId);
    if (module && nativeCallId) {
      await module.reportVideo(nativeCallId, enabled);
    }
  }

  registerVoipPush() {
    this.getModule()?.registerVoIPPush();
  }

  getVoipPushToken() {
    return this.getModule()?.getVoIPPushToken() ?? null;
  }

  subscribeVoipPushToken(listener: (token: VoipPushToken | null) => void) {
    const module = this.getModule();
    if (!module?.addVoIPPushTokenUpdatedListener) {
      return () => undefined;
    }

    const subscription = module.addVoIPPushTokenUpdatedListener((event) => {
      listener(event.token ? { token: event.token, type: event.type } : null);
    });
    return () => subscription.remove();
  }

  private getModule() {
    this.initialize();
    return this.nativeModule ?? null;
  }

  private setMapping(serverCallId: string, nativeCallId: string) {
    this.serverToNative.set(serverCallId, nativeCallId);
    this.nativeToServer.set(nativeCallId, serverCallId);
  }

  private removeMapping(serverCallId: string) {
    const nativeCallId = this.serverToNative.get(serverCallId);
    this.serverToNative.delete(serverCallId);
    if (nativeCallId) {
      this.nativeToServer.delete(nativeCallId);
    }
  }

  private captureSession(session: NativeCallSession | undefined | null) {
    const serverCallId = session?.incomingCallEvent?.serverCallId;
    if (!serverCallId || !session?.id) {
      return undefined;
    }
    this.setMapping(serverCallId, session.id);
    return serverCallId;
  }

  private async resolveNativeCallId(callId: string) {
    const existing = this.serverToNative.get(callId);
    if (existing) {
      return existing;
    }

    const session = await this.getModule()?.getActiveCallSession();
    this.captureSession(session);
    return this.serverToNative.get(callId);
  }

  private async resolveServerCallId(nativeCallId: string) {
    const existing = this.nativeToServer.get(nativeCallId);
    if (existing) {
      return existing;
    }

    const session = await this.getModule()?.getActiveCallSession();
    const serverCallId = this.captureSession(session);
    return serverCallId ?? this.nativeToServer.get(nativeCallId);
  }

  private toIncomingCall(session: NativeCallSession | null): NativeCallUiIncomingCall | null {
    const incoming = session?.incomingCallEvent;
    if (!session || !incoming?.serverCallId || !incoming.caller?.id) {
      return null;
    }

    const metadataUsername = getMetadataValue(incoming.metadata, 'username');
    const username = metadataUsername && isProfileUsername(metadataUsername)
      ? metadataUsername
      : incoming.caller.id.slice(0, 8).toLowerCase();
    const parsedTimestamp = incoming.startedAt ? Date.parse(incoming.startedAt) : NaN;

    return {
      serverCallId: incoming.serverCallId,
      nativeCallId: session.id,
      peerId: incoming.caller.id,
      kind: incoming.hasVideo ? 'video' : 'voice',
      profile: {
        username,
        displayName: incoming.caller.displayName?.trim() || 'Callnet user',
        photoURL: incoming.caller.avatarUrl ?? null,
      },
      timestamp: Number.isFinite(parsedTimestamp) ? parsedTimestamp : Date.now(),
    };
  }

  private emit(event: NativeCallUiEvent) {
    this.listeners.forEach((listener) => listener(event));
  }
}

export const nativeCallUi: NativeCallUi = new NativeCallUiAdapter();
