import {
  DEVELOPMENT_IDENTITY_IDS,
  type DevelopmentIdentity,
  type DevelopmentIdentityId,
} from '../../../shared/call-protocol';

declare const __DEV__: boolean;

export type CallTransportMode = 'demo' | 'webrtc';

export function getDevelopmentIdentity(
  requestedId = process.env.EXPO_PUBLIC_DEV_IDENTITY,
): DevelopmentIdentity {
  if (!__DEV__) {
    throw new Error('Seeded development identities are disabled outside development builds.');
  }

  const id = requestedId as DevelopmentIdentityId | undefined;
  if (!id || !DEVELOPMENT_IDENTITY_IDS.includes(id)) {
    throw new Error('EXPO_PUBLIC_DEV_IDENTITY must be device-a or device-b.');
  }

  return { mode: 'development', id };
}

export function getCallTransportMode(): CallTransportMode {
  return __DEV__ && process.env.EXPO_PUBLIC_CALL_MODE === 'webrtc' ? 'webrtc' : 'demo';
}

export function getSignalingUrl() {
  return process.env.EXPO_PUBLIC_SIGNALING_URL ?? 'http://127.0.0.1:8787';
}

export function getIceServers() {
  const configuredUrls = (process.env.EXPO_PUBLIC_TURN_URLS ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  const turnUrl = process.env.EXPO_PUBLIC_TURN_URL;
  const turnUsername = process.env.EXPO_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.EXPO_PUBLIC_TURN_CREDENTIAL;
  const urls = configuredUrls.length > 0 ? configuredUrls : turnUrl ? [turnUrl] : [];
  const servers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [];
  const turnUrls = urls.filter((url) => url.startsWith('turn:') || url.startsWith('turns:'));

  urls
    .filter((url) => url.startsWith('stun:'))
    .forEach((url) => servers.push({ urls: url }));

  if (turnUrls.length > 0 && turnUsername && turnCredential) {
    servers.push({
      urls: turnUrls.length === 1 ? turnUrls[0] : turnUrls,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  if (servers.length === 0) {
    servers.push({ urls: 'stun:stun.l.google.com:19302' });
  }

  return servers;
}
