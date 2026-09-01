import {
  isCallEvent,
  type CallEvent,
  type DevelopmentIdentity,
} from '../../../shared/call-protocol';
import type { SignalingTransport } from './signaling-transport';

type SocketAck = (response: { ok: boolean; code?: string }) => void;

type SocketLike = {
  connected: boolean;
  connect(): void;
  disconnect(): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
  emit(event: string, payload: unknown, ack?: SocketAck): void;
};

type SocketIoClientModule = {
  io(url: string, options: Record<string, unknown>): SocketLike;
};

type SocketIoSignalingOptions = {
  url: string;
  connectTimeoutMs?: number;
  reconnectAttempts?: number;
};

declare const require: (moduleName: string) => unknown;

function loadSocketIoClient() {
  try {
    return require('socket.io-client') as SocketIoClientModule;
  } catch {
    throw new Error('socket.io-client is not installed. Install Phase 3 dependencies before enabling WebRTC mode.');
  }
}

export class SocketIoSignalingTransport implements SignalingTransport {
  private readonly listeners = new Set<(event: CallEvent) => void>();
  private readonly options: Required<SocketIoSignalingOptions>;
  private socket: SocketLike | null = null;
  private identity: DevelopmentIdentity | null = null;
  private readonly handleEvent = (...args: unknown[]) => {
    const [value] = args;
    if (!isCallEvent(value)) {
      return;
    }

    this.listeners.forEach((listener) => listener(value));
  };

  constructor(options: SocketIoSignalingOptions) {
    this.options = {
      connectTimeoutMs: 8_000,
      reconnectAttempts: 5,
      ...options,
    };
  }

  async connect(identity: DevelopmentIdentity) {
    if (this.socket?.connected) {
      return;
    }

    this.identity = identity;
    const { io } = loadSocketIoClient();
    const socket = io(this.options.url, {
      autoConnect: false,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.options.reconnectAttempts,
      auth: { identity },
    });
    this.socket = socket;
    socket.on('call:event', this.handleEvent);

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('Signaling connection timed out.'));
      }, this.options.connectTimeoutMs);

      const handleConnect = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        socket.off('connect', handleConnect);
        socket.off('connect_error', handleError);
        resolve();
      };
      const handleError = (...args: unknown[]) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        socket.off('connect', handleConnect);
        socket.off('connect_error', handleError);
        reject(args[0] instanceof Error ? args[0] : new Error('Signaling connection failed.'));
      };

      socket.on('connect', handleConnect);
      socket.on('connect_error', handleError);
      socket.connect();
    });
  }

  async send(event: CallEvent) {
    if (!this.socket?.connected || !this.identity || event.from !== this.identity.id) {
      throw new Error('Signaling transport is not connected for this identity.');
    }

    await new Promise<void>((resolve, reject) => {
      this.socket!.emit('call:event', event, (response) => {
        if (response.ok) {
          resolve();
          return;
        }
        reject(new Error(response.code ?? 'Signaling event rejected.'));
      });
    });
  }

  subscribe(listener: (event: CallEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async disconnect() {
    if (!this.socket) {
      return;
    }

    this.socket.off('call:event', this.handleEvent);
    this.socket.disconnect();
    this.socket = null;
    this.identity = null;
  }
}
