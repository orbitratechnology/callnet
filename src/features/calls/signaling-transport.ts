import type {
  CallEvent,
  DevelopmentIdentity,
} from '../../../shared/call-protocol';

export interface SignalingTransport {
  connect(identity: DevelopmentIdentity): Promise<void>;
  send(event: CallEvent): Promise<void>;
  subscribe(listener: (event: CallEvent) => void): () => void;
  disconnect(): Promise<void>;
}
