import type {
  CallEvent,
  CallIdentity,
} from '../../../shared/call-protocol';

export type AuthenticatedSignalingIdentity = {
  identity: CallIdentity;
  idToken: string;
};

export type SignalingTransportStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

export interface SignalingTransport {
  connect(identity: AuthenticatedSignalingIdentity): Promise<void>;
  send(event: CallEvent): Promise<void>;
  subscribe(listener: (event: CallEvent) => void): () => void;
  subscribeStatus?(listener: (status: SignalingTransportStatus) => void): () => void;
  disconnect(): Promise<void>;
}
