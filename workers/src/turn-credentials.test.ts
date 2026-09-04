import { describe, expect, it } from 'vitest';

import { parseIceServers } from './turn-credentials';

describe('parseIceServers', () => {
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
