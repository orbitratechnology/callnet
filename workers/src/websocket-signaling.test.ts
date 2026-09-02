import { describe, expect, it } from 'vitest';
import { createCallEvent } from '../../shared/call-protocol';
import {
  WebSocketSignalingTransport,
  type WebSocketLike,
  toSignalingWebSocketUrl,
} from '../../src/features/calls/websocket-signaling';

class FakeSocket implements WebSocketLike {
  readyState = 0;
  onopen: WebSocketLike['onopen'] = null;
  onmessage: WebSocketLike['onmessage'] = null;
  onerror: WebSocketLike['onerror'] = null;
  onclose: WebSocketLike['onclose'] = null;
  readonly sent: string[] = [];

  open() {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code = 1000, reason = '') {
    this.readyState = 3;
    this.onclose?.({ code, reason } as CloseEvent);
  }

  receive(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) } as MessageEvent);
  }
}

const identity = {
  identity: { mode: 'firebase' as const, uid: 'test-user' },
  idToken: 'test-token',
};

const event = createCallEvent({
  type: 'call:end',
  callId: 'transport-test-call',
  from: 'test-user',
  to: 'peer-user',
  payload: { kind: 'empty' },
});

describe('WebSocketSignalingTransport', () => {
  it('converts the configured URL to the Worker WebSocket endpoint', () => {
    expect(toSignalingWebSocketUrl('https://signal.example.com')).toBe('wss://signal.example.com/ws');
    expect(toSignalingWebSocketUrl('http://127.0.0.1:8787/ws')).toBe('ws://127.0.0.1:8787/ws');
  });

  it('negotiates callnet.v1 and resolves sends from correlated ACKs', async () => {
    const sockets: FakeSocket[] = [];
    const transport = new WebSocketSignalingTransport({
      url: 'https://signal.example.com',
      webSocketFactory: (url, protocols) => {
        expect(url).toBe('wss://signal.example.com/ws');
        expect(protocols).toEqual(['callnet.v1', 'test-token']);
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
    });

    const connection = transport.connect(identity);
    sockets[0].open();
    await connection;

    const sending = transport.send(event);
    const frame = JSON.parse(sockets[0].sent[0]) as { requestId: string };
    sockets[0].receive({ version: 2, kind: 'ack', requestId: frame.requestId, ok: true });
    await sending;
    await transport.disconnect();
  });

  it('resends the same request ID after a connection drop', async () => {
    const sockets: FakeSocket[] = [];
    const transport = new WebSocketSignalingTransport({
      url: 'ws://signal.example.com/ws',
      reconnectBaseDelayMs: 1,
      reconnectMaxDelayMs: 1,
      random: () => 0,
      webSocketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
    });

    const connection = transport.connect(identity);
    sockets[0].open();
    await connection;

    const sending = transport.send(event);
    const firstFrame = JSON.parse(sockets[0].sent[0]) as { requestId: string };
    sockets[0].close(1006, 'network interruption');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sockets).toHaveLength(2);

    sockets[1].open();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const resentFrame = JSON.parse(sockets[1].sent[0]) as { requestId: string };
    expect(resentFrame.requestId).toBe(firstFrame.requestId);
    sockets[1].receive({ version: 2, kind: 'ack', requestId: resentFrame.requestId, ok: true });
    await sending;
    await transport.disconnect();
  });

  it('rejects an opening connection when clean shutdown is requested', async () => {
    const transport = new WebSocketSignalingTransport({
      url: 'ws://signal.example.com/ws',
      webSocketFactory: () => new FakeSocket(),
    });

    const connection = transport.connect(identity);
    await transport.disconnect();
    await expect(connection).rejects.toMatchObject({ code: 'disconnected' });
  });
});
