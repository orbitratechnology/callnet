import type { ActiveCallSnapshot } from '../../../shared/call-protocol';

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

function isActiveCallSnapshot(value: unknown): value is ActiveCallSnapshot {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const call = value as Partial<ActiveCallSnapshot>;
  return Boolean(
    typeof call.callId === 'string' && call.callId.length > 0 && call.callId.length <= 128 &&
      typeof call.peerId === 'string' && call.peerId.length > 0 && call.peerId.length <= 128 &&
      (call.kind === 'voice' || call.kind === 'video') &&
      (call.direction === 'incoming' || call.direction === 'outgoing') &&
      (call.state === 'ringing' || call.state === 'connected') &&
      typeof call.createdAt === 'number' && Number.isFinite(call.createdAt) &&
      typeof call.updatedAt === 'number' && Number.isFinite(call.updatedAt),
  );
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

export async function getActiveCallSnapshots(idToken: string): Promise<ActiveCallSnapshot[] | null> {
  try {
    const response = await fetch(`${getSignalingHttpUrl()}/calls/active`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`active-calls-http-${response.status}`);
    }

    const value = (await response.json()) as unknown;
    if (!value || typeof value !== 'object' || !Array.isArray((value as { calls?: unknown }).calls)) {
      throw new Error('active-calls-invalid');
    }

    const calls = (value as { calls: unknown[] }).calls;
    if (!calls.every(isActiveCallSnapshot)) {
      throw new Error('active-calls-invalid');
    }

    return calls;
  } catch {
    return null;
  }
}
