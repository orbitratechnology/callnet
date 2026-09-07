export type PermissionResult = 'granted' | 'denied';

export type MediaTrackLike = {
  kind?: 'audio' | 'video';
  enabled: boolean;
  stop(): void;
  _switchCamera?(): void;
};

export type MediaStreamLike = {
  getTracks?(): MediaTrackLike[];
  toURL?(): string;
  release?(): void;
};

export type SessionDescription = {
  type: 'offer' | 'answer';
  sdp: string;
};

export type IceCandidate = {
  candidate: string | null;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
};

export type LocalMedia = {
  kind: 'audio' | 'video';
  stream: MediaStreamLike;
  streamUrl: string;
};

export interface MediaEngine {
  requestPermissions(kind: 'audio' | 'video'): Promise<PermissionResult>;
  startLocalMedia(kind: 'audio' | 'video'): Promise<LocalMedia>;
  createOffer(): Promise<SessionDescription>;
  createAnswer(): Promise<SessionDescription>;
  setRemoteDescription(description: SessionDescription): Promise<void>;
  addIceCandidate(candidate: IceCandidate): Promise<void>;
  close(): Promise<void>;
}

type PeerConnectionLike = {
  addTrack?(track: MediaTrackLike, stream: MediaStreamLike): void;
  createOffer(): Promise<SessionDescription>;
  createAnswer(): Promise<SessionDescription>;
  setLocalDescription(description: SessionDescription): Promise<void>;
  setRemoteDescription(description: SessionDescription): Promise<void>;
  addIceCandidate(candidate: IceCandidate): Promise<void>;
  close(): void;
  onicecandidate?: ((event: { candidate: IceCandidate | null }) => void) | null;
  ontrack?: ((event: { streams?: MediaStreamLike[] }) => void) | null;
  onaddstream?: ((event: { stream: MediaStreamLike }) => void) | null;
};

type WebRTCModule = {
  mediaDevices: {
    getUserMedia(constraints: Record<string, unknown>): Promise<MediaStreamLike>;
  };
  permissions?: {
    request(permission: { name: 'camera' | 'microphone' }): Promise<unknown>;
  };
  RTCPeerConnection: new (configuration: { iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> }) => PeerConnectionLike;
  RTCSessionDescription?: new (description: SessionDescription) => SessionDescription;
  RTCIceCandidate?: new (candidate: IceCandidate) => IceCandidate;
};

export type NativeWebRTCMediaEngineOptions = {
  iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  onIceCandidate?: (candidate: IceCandidate) => void;
  onRemoteStream?: (stream: MediaStreamLike) => void;
};

declare const require: (moduleName: string) => unknown;

function unwrapDefault<T>(value: unknown): T {
  if (value && typeof value === 'object' && 'default' in value) {
    return (value as { default: T }).default;
  }

  return value as T;
}

function loadWebRTCModule() {
  try {
    const rtc = unwrapDefault<WebRTCModule>(require('@livekit/react-native-webrtc'));

    if (!rtc || typeof rtc.RTCPeerConnection !== 'function') {
      throw new Error('webrtc-peer-connection-unavailable');
    }

    if (!rtc.mediaDevices || typeof rtc.mediaDevices.getUserMedia !== 'function') {
      throw new Error('webrtc-media-devices-unavailable');
    }

    return rtc;
  } catch {
    throw new Error('webrtc-native-module-unavailable');
  }
}

const defaultIceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

function isPermissionDeniedError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const value = error as { name?: unknown; code?: unknown; message?: unknown };
  const details = [value.name, value.code, value.message]
    .filter((detail): detail is string => typeof detail === 'string')
    .join(' ')
    .toLowerCase();

  return details.includes('notallowed') ||
    details.includes('permissiondenied') ||
    /permission\s+(was\s+)?denied/.test(details) ||
    /access\s+(was\s+)?denied/.test(details);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getStreamTracks(stream: MediaStreamLike) {
  try {
    const tracks = stream.getTracks?.();
    return Array.isArray(tracks) ? tracks : [];
  } catch {
    return [];
  }
}

function releaseStream(stream: MediaStreamLike | null) {
  if (!stream) {
    return;
  }

  getStreamTracks(stream).forEach((track) => track.stop());
  stream.release?.();
}

export class NativeWebRTCMediaEngine implements MediaEngine {
  private readonly options: Required<NativeWebRTCMediaEngineOptions>;
  private readonly rtc = loadWebRTCModule();
  private peerConnection: PeerConnectionLike | null = null;
  private localMedia: LocalMedia | null = null;
  private pendingMedia: LocalMedia | null = null;

  constructor(options: NativeWebRTCMediaEngineOptions = {}) {
    this.options = {
      iceServers: options.iceServers ?? defaultIceServers,
      onIceCandidate: options.onIceCandidate ?? (() => undefined),
      onRemoteStream: options.onRemoteStream ?? (() => undefined),
    };
  }

  async requestPermissions(kind: 'audio' | 'video') {
    try {
      if (this.pendingMedia?.kind === kind) {
        return 'granted' as const;
      }

      if (this.rtc.permissions) {
        const microphoneGranted = await this.rtc.permissions.request({ name: 'microphone' });
        if (microphoneGranted !== true && microphoneGranted !== 'granted') {
          return 'denied' as const;
        }

        if (kind === 'video') {
          const cameraGranted = await this.rtc.permissions.request({ name: 'camera' });
          if (cameraGranted !== true && cameraGranted !== 'granted') {
            return 'denied' as const;
          }
        }
      }

      const stream = await this.rtc.mediaDevices.getUserMedia({
        audio: true,
        video: kind === 'video' ? { facingMode: 'user' } : false,
      });
      this.pendingMedia = {
        kind,
        stream,
        streamUrl: stream.toURL?.() ?? '',
      };
      return 'granted' as const;
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        return 'denied' as const;
      }

      throw new Error(`${kind}-media-unavailable:${getErrorMessage(error)}`);
    }
  }

  async startLocalMedia(kind: 'audio' | 'video') {
    if (!this.pendingMedia || this.pendingMedia.kind !== kind) {
      const permission = await this.requestPermissions(kind);
      if (permission === 'denied' || !this.pendingMedia) {
        throw new Error(`${kind}-permission-denied`);
      }
    }

    this.localMedia = this.pendingMedia;
    this.pendingMedia = null;
    this.ensurePeerConnection();

    for (const track of getStreamTracks(this.localMedia.stream)) {
      this.peerConnection?.addTrack?.(track, this.localMedia.stream);
    }

    return this.localMedia;
  }

  async createOffer() {
    const peerConnection = this.ensurePeerConnection();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    return offer;
  }

  async createAnswer() {
    const peerConnection = this.ensurePeerConnection();
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    return answer;
  }

  async setRemoteDescription(description: SessionDescription) {
    const remoteDescription = this.rtc.RTCSessionDescription
      ? new this.rtc.RTCSessionDescription(description)
      : description;
    await this.ensurePeerConnection().setRemoteDescription(remoteDescription);
  }

  async addIceCandidate(candidate: IceCandidate) {
    const remoteCandidate = this.rtc.RTCIceCandidate
      ? new this.rtc.RTCIceCandidate(candidate)
      : candidate;
    await this.ensurePeerConnection().addIceCandidate(remoteCandidate);
  }

  async close() {
    releaseStream(this.pendingMedia?.stream ?? null);
    releaseStream(this.localMedia?.stream ?? null);
    this.pendingMedia = null;
    this.localMedia = null;
    this.peerConnection?.close();
    this.peerConnection = null;
  }

  private ensurePeerConnection() {
    if (this.peerConnection) {
      return this.peerConnection;
    }

    const peerConnection = new this.rtc.RTCPeerConnection({
      iceServers: this.options.iceServers,
    });
    peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.options.onIceCandidate(candidate);
      }
    };
    peerConnection.ontrack = ({ streams }) => {
      const stream = streams?.[0];
      if (stream) {
        this.options.onRemoteStream(stream);
      }
    };
    peerConnection.onaddstream = ({ stream }) => this.options.onRemoteStream(stream);
    this.peerConnection = peerConnection;
    return peerConnection;
  }
}
