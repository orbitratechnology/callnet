import {
  createCallEvent,
  type CallEvent,
  type CallEventType,
  type CallKind,
  type CallSignalPayload,
  type CallIdentity,
  type CallIdentityId,
  type CallTerminationReason,
} from '../../../shared/call-protocol';
import { NativeAudioRoutingAdapter, type AudioRoutingAdapter } from './audio-routing';
import {
  NativeWebRTCMediaEngine,
  type IceCandidate,
  type LocalMedia,
  type MediaEngine,
  type MediaStreamLike,
  type SessionDescription,
} from './media-engine';
import { SocketIoSignalingTransport } from './socket-io-signaling';
import type { SignalingTransport } from './signaling-transport';

export type RealCallControllerEvent =
  | { type: 'incoming'; callId: string; kind: CallKind; from: CallIdentityId; timestamp: number }
  | { type: 'state'; callId: string; state: 'connecting' | 'connected' | 'ended' | 'failed'; failureReason?: string }
  | { type: 'streams'; localStreamUrl: string | null; remoteStreamUrl: string | null };

export type WebRTCCallControllerOptions = {
  identity: CallIdentity;
  authToken: string;
  signalingUrl: string;
  iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  transport?: SignalingTransport;
  mediaEngine?: MediaEngine;
  audioRouter?: AudioRoutingAdapter;
};

type ActiveCall = {
  callId: string;
  peerId: CallIdentityId;
  kind: CallKind;
  direction: 'incoming' | 'outgoing';
  state: 'ringing' | 'connecting' | 'connected';
  remoteDescriptionSet: boolean;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export class WebRTCCallController {
  private readonly identity: CallIdentity;
  private readonly authToken: string;
  private readonly transport: SignalingTransport;
  private readonly media: MediaEngine;
  private readonly audioRouter: AudioRoutingAdapter;
  private readonly listeners = new Set<(event: RealCallControllerEvent) => void>();
  private readonly pendingIceCandidates: IceCandidate[] = [];
  private activeCall: ActiveCall | null = null;
  private pendingOffer: CallEvent | null = null;
  private localMedia: LocalMedia | null = null;
  private remoteStreamUrl: string | null = null;
  private isConnected = false;
  private unsubscribeFromTransport: (() => void) | null = null;

  constructor(options: WebRTCCallControllerOptions) {
    this.identity = options.identity;
    this.authToken = options.authToken;
    this.transport = options.transport ?? new SocketIoSignalingTransport({ url: options.signalingUrl });
    this.audioRouter = options.audioRouter ?? new NativeAudioRoutingAdapter();
    this.media = options.mediaEngine ?? new NativeWebRTCMediaEngine({
      iceServers: options.iceServers,
      onIceCandidate: (candidate) => {
        void this.sendIceCandidate(candidate).catch(() => undefined);
      },
      onRemoteStream: (stream) => this.handleRemoteStream(stream),
    });
  }

  async connect() {
    if (this.isConnected) {
      return;
    }

    this.unsubscribeFromTransport = this.transport.subscribe((event) => void this.handleEvent(event));
    await this.transport.connect({ identity: this.identity, idToken: this.authToken });
    this.isConnected = true;
  }

  subscribe(listener: (event: RealCallControllerEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async startOutgoing(input: { callId: string; peerId: CallIdentityId; kind: CallKind }) {
    await this.connect();
    if (this.activeCall) {
      throw new Error('A WebRTC call is already active.');
    }

    this.activeCall = {
      callId: input.callId,
      peerId: input.peerId,
      kind: input.kind,
      direction: 'outgoing',
      state: 'connecting',
      remoteDescriptionSet: false,
    };

    try {
      await this.startLocalMedia(input.kind);
      try {
        this.audioRouter.start(input.kind);
      } catch (error) {
        throw new Error(`audio-routing-start:${getErrorMessage(error)}`);
      }
      await this.sendEvent(input.callId, input.peerId, 'call:invite', {
        kind: 'call',
        callKind: input.kind,
      });
      this.emit({ type: 'state', callId: input.callId, state: 'connecting' });
      let offer: SessionDescription;
      try {
        offer = await this.media.createOffer();
      } catch (error) {
        throw new Error(`webrtc-create-offer:${getErrorMessage(error)}`);
      }
      await this.sendEvent(input.callId, input.peerId, 'webrtc:offer', {
        kind: 'session-description',
        type: 'offer',
        sdp: offer.sdp,
      });
    } catch (error) {
      await this.failActiveCall(
        input.callId,
        error instanceof Error ? error.message : 'webrtc-start-failed',
      );
      throw error;
    }
  }

  async acceptIncoming() {
    const call = this.activeCall;
    if (!call || call.direction !== 'incoming' || call.state !== 'ringing') {
      return;
    }

    try {
      await this.startLocalMedia(call.kind);
      try {
        this.audioRouter.start(call.kind);
      } catch (error) {
        throw new Error(`audio-routing-start:${getErrorMessage(error)}`);
      }
      call.state = 'connecting';
      await this.sendEvent(call.callId, call.peerId, 'call:accept', { kind: 'empty' });
      this.emit({ type: 'state', callId: call.callId, state: 'connecting' });

      if (this.pendingOffer) {
        const offer = this.pendingOffer;
        this.pendingOffer = null;
        await this.handleOffer(offer);
      }
    } catch (error) {
      await this.failActiveCall(
        call.callId,
        error instanceof Error ? error.message : 'webrtc-accept-failed',
      );
      throw error;
    }
  }

  async reject() {
    await this.finishActiveCall('call:reject', 'rejected');
  }

  async cancel(reason: CallTerminationReason = 'cancelled') {
    await this.finishActiveCall('call:cancel', reason);
  }

  async end() {
    await this.finishActiveCall('call:end');
  }

  setMuted(muted: boolean) {
    (this.localMedia?.stream.getTracks?.() ?? []).forEach((track) => {
      if (!track.kind || track.kind === 'audio') track.enabled = !muted;
    });
  }

  setCameraEnabled(enabled: boolean) {
    (this.localMedia?.stream.getTracks?.() ?? []).forEach((track) => {
      if (track.kind === 'video') track.enabled = enabled;
    });
  }

  switchCamera() {
    (this.localMedia?.stream.getTracks?.() ?? []).forEach((track) => {
      if (track.kind === 'video') track._switchCamera?.();
    });
  }

  setSpeakerEnabled(enabled: boolean) {
    this.audioRouter.setSpeakerEnabled(enabled);
  }

  async disconnect() {
    this.unsubscribeFromTransport?.();
    this.unsubscribeFromTransport = null;
    this.isConnected = false;
    await this.cleanupMedia();
    await this.transport.disconnect();
  }

  private async handleEvent(event: CallEvent) {
    if (event.to !== this.identity.uid) {
      return;
    }

    if (event.type === 'call:invite') {
      await this.handleInvite(event);
      return;
    }

    if (!this.activeCall || event.callId !== this.activeCall.callId) {
      return;
    }

    if (event.type === 'call:accept' && this.activeCall.direction === 'outgoing') {
      this.activeCall.state = 'connecting';
      this.emit({ type: 'state', callId: event.callId, state: 'connecting' });
      return;
    }

    if (event.type === 'call:reject' || event.type === 'call:cancel' || event.type === 'call:end') {
      const callId = this.activeCall.callId;
      const failureReason = event.type === 'call:reject'
        ? 'rejected'
        : event.type === 'call:cancel'
          ? event.payload.kind === 'empty' && event.payload.reason === 'timed-out'
            ? 'timed-out'
            : 'cancelled'
          : undefined;
      await this.cleanupActiveCall();
      this.emit({ type: 'state', callId, state: 'ended', failureReason });
      return;
    }

    if (event.type === 'webrtc:offer' && this.activeCall.direction === 'incoming') {
      if (this.activeCall.state === 'ringing') {
        this.pendingOffer = event;
      } else {
        await this.handleOffer(event);
      }
      return;
    }

    if (event.type === 'webrtc:answer' && this.activeCall.direction === 'outgoing') {
      await this.handleAnswer(event);
      return;
    }

    if (event.type === 'webrtc:ice-candidate') {
      if (this.activeCall.remoteDescriptionSet) {
        await this.media.addIceCandidate(this.getIceCandidate(event));
      } else {
        this.pendingIceCandidates.push(this.getIceCandidate(event));
      }
    }
  }

  private async handleInvite(event: CallEvent) {
    if (this.activeCall || event.payload.kind !== 'call') {
      return;
    }

    this.activeCall = {
      callId: event.callId,
      peerId: event.from,
      kind: event.payload.callKind,
      direction: 'incoming',
      state: 'ringing',
      remoteDescriptionSet: false,
    };
    this.emit({
      type: 'incoming',
      callId: event.callId,
      kind: event.payload.callKind,
      from: event.from,
      timestamp: event.timestamp,
    });
  }

  private async handleOffer(event: CallEvent) {
    if (!this.activeCall || event.payload.kind !== 'session-description' || event.payload.type !== 'offer') {
      return;
    }

    await this.media.setRemoteDescription(this.getSessionDescription(event));
    this.activeCall.remoteDescriptionSet = true;
    await this.flushIceCandidates();
    const answer = await this.media.createAnswer();
    await this.sendEvent(event.callId, event.from, 'webrtc:answer', {
      kind: 'session-description',
      type: 'answer',
      sdp: answer.sdp,
    });
    this.activeCall.state = 'connected';
    this.emit({ type: 'state', callId: event.callId, state: 'connected' });
  }

  private async handleAnswer(event: CallEvent) {
    if (!this.activeCall || event.payload.kind !== 'session-description' || event.payload.type !== 'answer') {
      return;
    }

    await this.media.setRemoteDescription(this.getSessionDescription(event));
    this.activeCall.remoteDescriptionSet = true;
    await this.flushIceCandidates();
    this.activeCall.state = 'connected';
    this.emit({ type: 'state', callId: event.callId, state: 'connected' });
  }

  private async startLocalMedia(kind: CallKind) {
    try {
      const localMedia = await this.media.startLocalMedia(kind === 'video' ? 'video' : 'audio');
      this.localMedia = localMedia;
      this.emit({ type: 'streams', localStreamUrl: localMedia.streamUrl, remoteStreamUrl: this.remoteStreamUrl });
    } catch (error) {
      throw new Error(`webrtc-local-media:${getErrorMessage(error)}`);
    }
  }

  private handleRemoteStream(stream: MediaStreamLike) {
    this.remoteStreamUrl = stream.toURL?.() ?? '';
    this.emit({ type: 'streams', localStreamUrl: this.localMedia?.streamUrl ?? null, remoteStreamUrl: this.remoteStreamUrl });
  }

  private async sendIceCandidate(candidate: IceCandidate) {
    const call = this.activeCall;
    if (!call) {
      return;
    }

    await this.sendEvent(call.callId, call.peerId, 'webrtc:ice-candidate', {
      kind: 'ice-candidate',
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
    });
  }

  private async sendEvent(
    callId: string,
    peerId: CallIdentityId,
    type: CallEventType,
    payload: CallSignalPayload,
  ) {
    await this.transport.send(createCallEvent({
      type,
      callId,
      from: this.identity.uid,
      to: peerId,
      payload,
    }));
  }

  private async finishActiveCall(type: 'call:reject' | 'call:cancel' | 'call:end', failureReason?: string) {
    const call = this.activeCall;
    if (!call) {
      return;
    }

    try {
      await this.sendEvent(
        call.callId,
        call.peerId,
        type,
        type === 'call:cancel'
          ? { kind: 'empty', reason: failureReason === 'timed-out' ? 'timed-out' : 'cancelled' }
          : { kind: 'empty' },
      );
    } finally {
      await this.cleanupActiveCall();
      this.emit({ type: 'state', callId: call.callId, state: 'ended', failureReason });
    }
  }

  private async failActiveCall(callId: string, failureReason: string) {
    await this.cleanupActiveCall();
    this.emit({ type: 'state', callId, state: 'failed', failureReason });
  }

  private async cleanupActiveCall() {
    const call = this.activeCall;
    this.activeCall = null;
    this.pendingOffer = null;
    this.pendingIceCandidates.length = 0;
    await this.cleanupMedia();
    return call;
  }

  private async cleanupMedia() {
    try {
      this.audioRouter.stop();
    } catch {
      // Native audio cleanup is best-effort and must not block call teardown.
    }
    try {
      await this.media.close();
    } catch {
      // Native media cleanup is best-effort and must not block call teardown.
    }
    this.localMedia = null;
    this.remoteStreamUrl = null;
    this.emit({ type: 'streams', localStreamUrl: null, remoteStreamUrl: null });
  }

  private async flushIceCandidates() {
    while (this.pendingIceCandidates.length > 0) {
      const candidate = this.pendingIceCandidates.shift();
      if (candidate) {
        await this.media.addIceCandidate(candidate);
      }
    }
  }

  private getSessionDescription(event: CallEvent): SessionDescription {
    if (event.payload.kind !== 'session-description') {
      throw new Error('Expected a session description payload.');
    }
    return { type: event.payload.type, sdp: event.payload.sdp };
  }

  private getIceCandidate(event: CallEvent): IceCandidate {
    if (event.payload.kind !== 'ice-candidate') {
      throw new Error('Expected an ICE candidate payload.');
    }
    return {
      candidate: event.payload.candidate,
      sdpMid: event.payload.sdpMid,
      sdpMLineIndex: event.payload.sdpMLineIndex,
    };
  }

  private emit(event: RealCallControllerEvent) {
    this.listeners.forEach((listener) => listener(event));
  }
}
