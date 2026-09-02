export type CallTransportMode = 'demo' | 'webrtc';

export function getCallTransportMode(): CallTransportMode {
  return process.env.EXPO_PUBLIC_CALL_MODE === 'demo' ? 'demo' : 'webrtc';
}

export function getSignalingUrl() {
  return process.env.EXPO_PUBLIC_SIGNALING_URL ?? 'wss://callnet-signaling.orbitra-technology.workers.dev';
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
