import { describe, expect, it } from 'vitest';
import {
  getFirebaseTokenFromSubprotocolHeader,
  SIGNALING_SUBPROTOCOL,
} from './protocol';

describe('WebSocket authentication subprotocol parsing', () => {
  it('extracts the Firebase token from the approved protocol order', () => {
    expect(
      getFirebaseTokenFromSubprotocolHeader(`${SIGNALING_SUBPROTOCOL}, eyJhbGciOiJSUzI1NiJ9.token.sig`),
    ).toBe('eyJhbGciOiJSUzI1NiJ9.token.sig');
  });

  it('allows normal header whitespace', () => {
    expect(
      getFirebaseTokenFromSubprotocolHeader(` ${SIGNALING_SUBPROTOCOL} , token `),
    ).toBe('token');
  });

  it('rejects missing, reordered, or extra protocols', () => {
    expect(getFirebaseTokenFromSubprotocolHeader(null)).toBeNull();
    expect(getFirebaseTokenFromSubprotocolHeader('token, callnet.v1')).toBeNull();
    expect(getFirebaseTokenFromSubprotocolHeader('callnet.v1, token, extra')).toBeNull();
  });
});

