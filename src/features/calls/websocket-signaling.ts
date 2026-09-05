import {
  createClientSignalingMessage,
  isServerSignalingMessage,
  SIGNALING_SUBPROTOCOL,
  type ServerSignalingMessage,
} from '../../../shared/signaling-protocol';
import type { CallEvent } from '../../../shared/call-protocol';
import type {
  AuthenticatedSignalingIdentity,
  SignalingTransport,
  SignalingTransportStatus,
} from './signaling-transport';

const SOCKET_OPEN = 1;
const DEFAULT_CONNECT_TIMEOUT_MS = 8_000;
const DEFAULT_ACK_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 8;
const DEFAULT_RECONNECT_BASE_DELAY_MS = 500;
const DEFAULT_RECONNECT_MAX_DELAY_MS = 15_000;
const DEFAULT_MAX_QUEUED_EVENTS = 32;
const DEFAULT_MAX_PENDING_EVENTS = 128;

export type WebSocketLike = {
  readyState: number;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
};

type WebSocketFactory = (url: string, protocols: string[]) => WebSocketLike;

type WebSocketSignalingOptions = {
  url: string;
  connectTimeoutMs?: number;
  ackTimeoutMs?: number;
  maxReconnectAttempts?: number;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
  maxQueuedEvents?: number;
  maxPendingEvents?: number;
  random?: () => number;
  webSocketFactory?: WebSocketFactory;
};

type ResolvedWebSocketSignalingOptions = {
  url: string;
  connectTimeoutMs: number;
  ackTimeoutMs: number;
  maxReconnectAttempts: number;
  reconnectBaseDelayMs: number;
  reconnectMaxDelayMs: number;
  maxQueuedEvents: number;
  maxPendingEvents: number;
  random: () => number;
  webSocketFactory: WebSocketFactory;
};

type PendingEvent = {
  requestId: string;
  frame: string;
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout> | null;
  queued: boolean;
  inFlight: boolean;
};

let requestSequence = 0;

export class SignalingTransportError extends Error {
  readonly code: string;

  constructor(message: string, code = 'signaling-error') {
    super(message);
    this.name = 'SignalingTransportError';
    this.code = code;
  }
}

export function toSignalingWebSocketUrl(input: string): string {
  const url = new URL(input.trim());
  if (url.protocol === 'http:') {
    url.protocol = 'ws:';
  } else if (url.protocol === 'https:') {
    url.protocol = 'wss:';
  } else if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new SignalingTransportError('Signaling URL must use http, https, ws, or wss.', 'invalid-url');
  }

  const pathname = url.pathname.replace(/\/+$/, '');
  url.pathname = pathname.endsWith('/ws') ? pathname : `${pathname}/ws`;
  return url.toString();
}

function createRequestId(): string {
  requestSequence = (requestSequence + 1) % 1_000_000;
  return `${Date.now().toString(36)}-${requestSequence.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function decodeMessage(data: unknown): string | null {
  if (typeof data === 'string') {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }
  return null;
}

function defaultWebSocketFactory(url: string, protocols: string[]): WebSocketLike {
  return new WebSocket(url, protocols);
}

export class WebSocketSignalingTransport implements SignalingTransport {
  private readonly listeners = new Set<(event: CallEvent) => void>();
  private readonly statusListeners = new Set<(status: SignalingTransportStatus) => void>();
  private readonly options: ResolvedWebSocketSignalingOptions;
  private readonly queue: PendingEvent[] = [];
  private readonly pending = new Map<string, PendingEvent>();
  private socket: WebSocketLike | null = null;
  private identity: AuthenticatedSignalingIdentity | null = null;
  private connectPromise: Promise<void> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private shouldReconnect = false;
  private rejectOpeningConnection: ((error: Error) => void) | null = null;
  private status: SignalingTransportStatus = 'offline';

  constructor(options: WebSocketSignalingOptions) {
    this.options = {
      url: toSignalingWebSocketUrl(options.url),
      connectTimeoutMs: options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS,
      ackTimeoutMs: options.ackTimeoutMs ?? DEFAULT_ACK_TIMEOUT_MS,
      maxReconnectAttempts: options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS,
      reconnectBaseDelayMs: options.reconnectBaseDelayMs ?? DEFAULT_RECONNECT_BASE_DELAY_MS,
      reconnectMaxDelayMs: options.reconnectMaxDelayMs ?? DEFAULT_RECONNECT_MAX_DELAY_MS,
      maxQueuedEvents: options.maxQueuedEvents ?? DEFAULT_MAX_QUEUED_EVENTS,
      maxPendingEvents: options.maxPendingEvents ?? DEFAULT_MAX_PENDING_EVENTS,
      random: options.random ?? Math.random,
      webSocketFactory: options.webSocketFactory ?? defaultWebSocketFactory,
    };
  }

  async connect(identity: AuthenticatedSignalingIdentity): Promise<void> {
    if (
      this.socket?.readyState === SOCKET_OPEN &&
      this.identity?.identity.uid === identity.identity.uid &&
      this.identity.idToken === identity.idToken
    ) {
      return;
    }

    if (this.identity && this.identity.identity.uid !== identity.identity.uid) {
      await this.disconnect();
    }

    this.identity = identity;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    this.setStatus('connecting');
    if (this.connectPromise) {
      return this.connectPromise;
    }

    const promise = this.openSocket(false);
    this.connectPromise = promise;
    try {
      await promise;
    } catch (error) {
      this.shouldReconnect = false;
      this.setStatus('offline');
      throw error;
    } finally {
      if (this.connectPromise === promise) {
        this.connectPromise = null;
      }
    }
  }

  send(event: CallEvent): Promise<void> {
    if (!this.identity || !this.shouldReconnect || event.from !== this.identity.identity.uid) {
      return Promise.reject(
        new SignalingTransportError(
          'Signaling transport is not connected for this identity.',
          'not-connected',
        ),
      );
    }
    if (this.pending.size >= this.options.maxPendingEvents) {
      return Promise.reject(new SignalingTransportError('Signaling queue is full.', 'queue-full'));
    }

    const requestId = createRequestId();
    const frame = JSON.stringify(createClientSignalingMessage(requestId, event));
    return new Promise<void>((resolve, reject) => {
      const pending: PendingEvent = {
        requestId,
        frame,
        resolve,
        reject,
        timeout: null,
        queued: false,
        inFlight: false,
      };
      this.pending.set(requestId, pending);

      if (this.socket?.readyState === SOCKET_OPEN) {
        this.sendPending(pending);
        return;
      }

      this.enqueue(pending);
      this.scheduleReconnect();
    });
  }

  subscribe(listener: (event: CallEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeStatus(listener: (status: SignalingTransportStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    this.reconnectAttempts = 0;
    this.setStatus('offline');
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const socket = this.socket;
    this.socket = null;
    this.rejectOpeningConnection?.(
      new SignalingTransportError('Signaling transport disconnected.', 'disconnected'),
    );
    this.rejectOpeningConnection = null;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close(1000, 'client disconnect');
    }

    this.rejectAll(new SignalingTransportError('Signaling transport disconnected.', 'disconnected'));
    this.identity = null;
    this.connectPromise = null;
  }

  private openSocket(isReconnect: boolean): Promise<void> {
    const identity = this.identity;
    if (!identity) {
      return Promise.reject(new SignalingTransportError('Signaling identity is missing.', 'not-connected'));
    }

    this.setStatus(isReconnect ? 'reconnecting' : 'connecting');

    let socket: WebSocketLike;
    try {
      socket = this.options.webSocketFactory(this.options.url, [SIGNALING_SUBPROTOCOL, identity.idToken]);
    } catch (error) {
      const failure = error instanceof Error ? error : new SignalingTransportError('WebSocket creation failed.');
      if (isReconnect) {
        this.scheduleReconnect();
      }
      return Promise.reject(failure);
    }

    this.socket = socket;
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        finishFailure(new SignalingTransportError('Signaling connection timed out.', 'connect-timeout'));
      }, this.options.connectTimeoutMs);

      const clearHandlers = () => {
        clearTimeout(timeout);
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
      };

      this.rejectOpeningConnection = reject;

      const finishFailure = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearHandlers();
        if (this.socket === socket) {
          this.socket = null;
        }
        if (this.rejectOpeningConnection === reject) {
          this.rejectOpeningConnection = null;
        }
        try {
          socket.close(1000, 'connection failed');
        } catch {
          // The socket may already be closed by the native runtime.
        }
        if (isReconnect && this.shouldReconnect) {
          this.scheduleReconnect();
        } else {
          this.setStatus('offline');
        }
        reject(error);
      };

      socket.onopen = () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        this.socket = socket;
        this.rejectOpeningConnection = null;
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        this.flushQueue();
        resolve();
      };
      socket.onmessage = (event) => this.handleMessage(event.data);
      socket.onerror = () => {
        if (!settled) {
          finishFailure(new SignalingTransportError('Signaling connection failed.', 'connect-failed'));
        }
      };
      socket.onclose = (event) => {
        if (!settled) {
          finishFailure(
            new SignalingTransportError(
              event.reason || 'Signaling connection closed before opening.',
              'connect-closed',
            ),
          );
          return;
        }
        this.handleClosed(socket);
      };
    });
  }

  private handleMessage(data: unknown): void {
    const text = decodeMessage(data);
    if (!text) {
      return;
    }

    try {
      const value: unknown = JSON.parse(text);
      if (!isServerSignalingMessage(value)) {
        return;
      }
      this.handleServerMessage(value);
    } catch {
      // Invalid frames are ignored; the Worker validates and bounds all client events.
    }
  }

  private handleServerMessage(message: ServerSignalingMessage): void {
    if (message.kind === 'call:event') {
      this.listeners.forEach((listener) => {
        try {
          listener(message.event);
        } catch {
          // A subscriber must not break transport frame processing.
        }
      });
      return;
    }

    if (message.kind === 'error') {
      return;
    }

    const pending = this.pending.get(message.requestId);
    if (!pending) {
      return;
    }

    this.pending.delete(message.requestId);
    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }
    pending.timeout = null;
    pending.inFlight = false;
    if (message.ok) {
      pending.resolve();
    } else {
      pending.reject(
        new SignalingTransportError(
          message.code ? `Signaling event rejected: ${message.code}.` : 'Signaling event rejected.',
          message.code ?? 'event-rejected',
        ),
      );
    }
  }

  private sendPending(pending: PendingEvent): void {
    if (!this.socket || this.socket.readyState !== SOCKET_OPEN || !this.pending.has(pending.requestId)) {
      this.enqueue(pending);
      return;
    }

    pending.queued = false;
    pending.inFlight = true;
    try {
      this.socket.send(pending.frame);
      pending.timeout = setTimeout(() => {
        if (!this.pending.has(pending.requestId)) {
          return;
        }
        this.pending.delete(pending.requestId);
        pending.inFlight = false;
        pending.reject(new SignalingTransportError('Signaling acknowledgement timed out.', 'ack-timeout'));
      }, this.options.ackTimeoutMs);
    } catch {
      pending.inFlight = false;
      this.enqueue(pending);
      this.socket.close(1011, 'send failed');
    }
  }

  private flushQueue(): void {
    while (this.queue.length > 0 && this.socket?.readyState === SOCKET_OPEN) {
      const pending = this.queue.shift();
      if (pending && this.pending.has(pending.requestId)) {
        pending.queued = false;
        this.sendPending(pending);
      }
    }
  }

  private enqueue(pending: PendingEvent): void {
    if (pending.queued || !this.pending.has(pending.requestId)) {
      return;
    }
    if (this.queue.length >= this.options.maxQueuedEvents) {
      pending.reject(new SignalingTransportError('Signaling queue is full.', 'queue-full'));
      this.pending.delete(pending.requestId);
      return;
    }
    pending.queued = true;
    this.queue.push(pending);
  }

  private handleClosed(socket: WebSocketLike): void {
    if (this.socket !== socket) {
      return;
    }
    this.socket = null;
    this.requeueInFlight();
    if (this.shouldReconnect) {
      this.setStatus('reconnecting');
      this.scheduleReconnect();
    } else {
      this.setStatus('offline');
    }
  }

  private requeueInFlight(): void {
    const inFlight = [...this.pending.values()].filter((pending) => pending.inFlight);
    inFlight.forEach((pending) => {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      pending.timeout = null;
      pending.inFlight = false;
      pending.queued = false;
    });
    this.queue.unshift(...inFlight);

    while (this.queue.length > this.options.maxQueuedEvents) {
      const pending = this.queue.pop();
      if (pending) {
        pending.queued = false;
        this.pending.delete(pending.requestId);
        pending.reject(new SignalingTransportError('Signaling queue is full.', 'queue-full'));
      }
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer || this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
        this.setStatus('offline');
        this.rejectAll(new SignalingTransportError('Signaling reconnect limit reached.', 'reconnect-exhausted'));
      }
      return;
    }

    this.setStatus('reconnecting');

    const exponentialDelay = Math.min(
      this.options.reconnectMaxDelayMs,
      this.options.reconnectBaseDelayMs * 2 ** this.reconnectAttempts,
    );
    const jitter = 0.75 + Math.max(0, Math.min(1, this.options.random())) * 0.5;
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.shouldReconnect) {
        return;
      }
      void this.openSocket(true).catch(() => undefined);
    }, Math.round(exponentialDelay * jitter));
  }

  private rejectAll(error: Error): void {
    const pending = [...this.pending.values()];
    this.pending.clear();
    this.queue.length = 0;
    pending.forEach((item) => {
      if (item.timeout) {
        clearTimeout(item.timeout);
      }
      item.timeout = null;
      item.queued = false;
      item.inFlight = false;
      item.reject(error);
    });
  }

  private setStatus(status: SignalingTransportStatus): void {
    if (this.status === status) {
      return;
    }

    this.status = status;
    this.statusListeners.forEach((listener) => {
      try {
        listener(status);
      } catch {
        // A status subscriber must not break transport lifecycle handling.
      }
    });
  }
}
