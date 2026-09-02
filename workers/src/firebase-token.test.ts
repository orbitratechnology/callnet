import { describe, expect, it, vi } from 'vitest';
import { verifyFirebaseIdToken } from './firebase-token';

describe('Firebase ID token verification boundaries', () => {
  it('rejects empty token input before contacting Google certificates', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(verifyFirebaseIdToken('', 'callnet-orbitra-20260902')).rejects.toThrow(
      'Firebase token input is invalid.',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('rejects an oversized token before contacting Google certificates', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(
      verifyFirebaseIdToken('x'.repeat(10_001), 'callnet-orbitra-20260902'),
    ).rejects.toThrow('Firebase token input is invalid.');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('rejects an invalid project configuration before contacting Google certificates', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(verifyFirebaseIdToken('not-a-jwt', '')).rejects.toThrow(
      'Firebase token input is invalid.',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

