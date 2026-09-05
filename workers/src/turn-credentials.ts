const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_ICE_SERVERS = 16;
const MAX_URLS_PER_SERVER = 8;
const MAX_FIELD_LENGTH = 4096;

export type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

function readBinding(env: object, name: string): string | undefined {
  const value: unknown = Reflect.get(env, name);
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function isUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_FIELD_LENGTH) {
    return false;
  }

  return value.startsWith('stun:') || value.startsWith('turn:') || value.startsWith('turns:');
}

function isIceServer(value: unknown): value is IceServerConfig {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const urls = candidate.urls;
  const validUrls = typeof urls === 'string'
    ? isUrl(urls)
    : Array.isArray(urls) && urls.length > 0 && urls.length <= MAX_URLS_PER_SERVER && urls.every(isUrl);

  if (!validUrls) {
    return false;
  }

  return (
    (candidate.username === undefined || (typeof candidate.username === 'string' && candidate.username.length <= MAX_FIELD_LENGTH)) &&
    (candidate.credential === undefined || (typeof candidate.credential === 'string' && candidate.credential.length <= MAX_FIELD_LENGTH))
  );
}

export function parseIceServers(value: unknown): IceServerConfig[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ICE_SERVERS) {
    return null;
  }

  const servers = value.filter(isIceServer).map((server) => ({
    urls: server.urls,
    ...(server.username !== undefined ? { username: server.username } : {}),
    ...(server.credential !== undefined ? { credential: server.credential } : {}),
  }));

  return servers.length === value.length ? servers : null;
}

export async function fetchMeteredIceServers(env: object): Promise<IceServerConfig[]> {
  const endpoint = readBinding(env, 'METERED_TURN_CREDENTIALS_URL');
  const apiKey = readBinding(env, 'METERED_TURN_API_KEY');

  if (!endpoint || !apiKey) {
    throw new Error('turn-provider-not-configured');
  }

  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.metered.live') || url.username || url.password) {
    throw new Error('turn-provider-url-invalid');
  }
  url.searchParams.set('apiKey', apiKey);

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`turn-provider-http-${response.status}`);
  }

  return readIceServersResponse(response);
}

export async function readIceServersResponse(response: Response): Promise<IceServerConfig[]> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('turn-provider-response-invalid');
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('turn-provider-response-too-large');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error('turn-provider-response-invalid');
  }

  const servers = parseIceServers(parsed);
  if (!servers) {
    throw new Error('turn-provider-response-invalid');
  }

  return servers;
}
