export type CallTransportMode = 'demo' | 'webrtc';

export function getCallTransportMode(): CallTransportMode {
  return process.env.EXPO_PUBLIC_CALL_MODE === 'demo' ? 'demo' : 'webrtc';
}

export function getSignalingUrl() {
  return process.env.EXPO_PUBLIC_SIGNALING_URL ?? 'wss://callnet-signaling.orbitra-technology.workers.dev';
}

export type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

const fallbackIceServers: IceServerConfig[] = [{ urls: 'stun:stun.l.google.com:19302' }];

function getSignalingHttpUrl() {
  const signalingUrl = getSignalingUrl();
  return signalingUrl.replace(/^ws(s?):\/\//, 'http$1://').replace(/\/ws\/?$/, '');
}

function isIceServer(value: unknown): value is IceServerConfig {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const urls = candidate.urls;
  const validUrls = typeof urls === 'string'
    ? urls.startsWith('stun:') || urls.startsWith('turn:') || urls.startsWith('turns:')
    : Array.isArray(urls) && urls.length > 0 && urls.every((url) => typeof url === 'string' && (url.startsWith('stun:') || url.startsWith('turn:') || url.startsWith('turns:')));

  return validUrls &&
    (candidate.username === undefined || typeof candidate.username === 'string') &&
    (candidate.credential === undefined || typeof candidate.credential === 'string');
}

export async function getIceServers(idToken: string): Promise<IceServerConfig[]> {
  try {
    const response = await fetch(`${getSignalingHttpUrl()}/ice-servers`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`turn-credentials-http-${response.status}`);
    }

    const servers = (await response.json()) as unknown;
    if (!Array.isArray(servers) || servers.length === 0 || !servers.every(isIceServer)) {
      throw new Error('turn-credentials-invalid');
    }

    return servers;
  } catch {
    return fallbackIceServers;
  }
}
