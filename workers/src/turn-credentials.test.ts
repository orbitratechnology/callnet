import { describe, expect, it } from 'vitest';

import { parseIceServers, readIceServersResponse } from './turn-credentials';
import worker from './index';
import { env } from 'cloudflare:workers';

describe('parseIceServers', () => {
  it('rejects invalid authentication before requesting credentials', async () => {
    const response = await worker.fetch(new Request('https://example.com/ice-servers', {
      headers: { Authorization: 'Bearer malformed-token' },
    }), env);
    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('cancels an oversized chunked response without consuming the remaining body', async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new Uint8Array(40 * 1024)); },
      cancel() { cancelled = true; },
    });
    await expect(readIceServersResponse(new Response(body))).rejects.toThrow('turn-provider-response-too-large');
    expect(cancelled).toBe(true);
  });

  it('rejects invalid JSON and accepts a bounded valid response', async () => {
    await expect(readIceServersResponse(new Response('{'))).rejects.toThrow('turn-provider-response-invalid');
    await expect(readIceServersResponse(Response.json([{ urls: 'stun:example.com' }]))).resolves.toEqual([{ urls: 'stun:example.com' }]);
  });
  it('accepts Metered STUN and TURN server entries', () => {
    expect(parseIceServers([
      { urls: 'stun:stun.example.com:80' },
      {
        urls: ['turn:turn.example.com:80', 'turns:turn.example.com:443'],
        username: 'user',
        credential: 'credential',
      },
    ])).toEqual([
      { urls: 'stun:stun.example.com:80' },
      {
        urls: ['turn:turn.example.com:80', 'turns:turn.example.com:443'],
        username: 'user',
        credential: 'credential',
      },
    ]);
  });

  it('rejects malformed or unsupported server entries', () => {
    expect(parseIceServers([{ urls: 'https://example.com' }])).toBeNull();
    expect(parseIceServers([{ urls: 'turn:example.com', credential: 123 }])).toBeNull();
    expect(parseIceServers([])).toBeNull();
  });
});
