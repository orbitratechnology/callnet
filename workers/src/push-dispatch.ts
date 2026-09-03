import { importPKCS8, SignJWT } from 'jose';

import type { CallEvent } from '../../shared/call-protocol';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SCOPE = [
  'https://www.googleapis.com/auth/datastore',
  'https://www.googleapis.com/auth/firebase.messaging',
].join(' ');
const FIRESTORE_RESPONSE_LIMIT_BYTES = 256 * 1024;
const MAX_DEVICE_TOKENS = 100;
const GOOGLE_TOKEN_LIFETIME_SECONDS = 3_600;
const APNS_TOKEN_LIFETIME_SECONDS = 3_600;
const APNS_DEFAULT_HOST = 'https://api.push.apple.com';
const DEFAULT_APNS_BUNDLE_ID = 'com.orbitratech.callnet';

type PushEnvironment = {
  firebaseProjectId: string;
  firebaseServiceAccountEmail?: string;
  firebaseServiceAccountPrivateKey?: string;
  apnsTeamId?: string;
  apnsKeyId?: string;
  apnsPrivateKey?: string;
  apnsBundleId: string;
  apnsHost: string;
};

type DeviceToken = {
  token: string;
  type: 'APNS_VOIP' | 'FCM';
};

export type IncomingCallPushEvent = {
  eventId: string;
  serverCallId: string;
  hasVideo: boolean;
  startedAt: string;
  caller: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  metadata: {
    username: string;
  };
};

export type PushDispatchResult = {
  delivered: boolean;
  code: string;
  attempted: number;
  succeeded: number;
};

type FirestoreStringValue = {
  stringValue?: unknown;
};

type FirestoreDocument = {
  fields?: Record<string, FirestoreStringValue>;
};

type GoogleAccessTokenCache = {
  cacheKey: string;
  token: string;
  expiresAt: number;
};

type PendingGoogleAccessToken = {
  cacheKey: string;
  promise: Promise<string>;
};

type ApnsProviderTokenCache = {
  cacheKey: string;
  token: string;
  expiresAt: number;
};

let googleAccessTokenCache: GoogleAccessTokenCache | null = null;
let pendingGoogleAccessToken: PendingGoogleAccessToken | null = null;
let apnsProviderTokenCache: ApnsProviderTokenCache | null = null;

function readBinding(env: object, name: string): string | undefined {
  const value: unknown = Reflect.get(env, name);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function getPushEnvironment(env: { FIREBASE_PROJECT_ID: string }): PushEnvironment {
  return {
    firebaseProjectId: env.FIREBASE_PROJECT_ID,
    firebaseServiceAccountEmail: readBinding(env, 'FIREBASE_SERVICE_ACCOUNT_EMAIL'),
    firebaseServiceAccountPrivateKey: readBinding(env, 'FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY'),
    apnsTeamId: readBinding(env, 'APNS_TEAM_ID'),
    apnsKeyId: readBinding(env, 'APNS_KEY_ID'),
    apnsPrivateKey: readBinding(env, 'APNS_PRIVATE_KEY'),
    apnsBundleId: readBinding(env, 'APNS_BUNDLE_ID') ?? DEFAULT_APNS_BUNDLE_ID,
    apnsHost: readBinding(env, 'APNS_HOST') ?? APNS_DEFAULT_HOST,
  };
}

function normalizePrivateKey(value: string): string {
  return value.replaceAll('\\n', '\n').trim();
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

function createPushResult(
  code: string,
  attempted = 0,
  succeeded = 0,
): PushDispatchResult {
  return {
    delivered: succeeded > 0,
    code,
    attempted,
    succeeded,
  };
}

function getFirestoreStringField(
  fields: Record<string, FirestoreStringValue> | undefined,
  name: string,
): string | undefined {
  const value = fields?.[name]?.stringValue;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isDeviceToken(value: DeviceToken): boolean {
  return value.token.length > 0 && value.token.length <= 4096;
}

function parseDeviceTokens(value: unknown): DeviceToken[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const documents = (value as { documents?: unknown }).documents;
  if (!Array.isArray(documents)) {
    return [];
  }

  const tokens = new Map<string, DeviceToken>();
  documents.forEach((document) => {
    if (!document || typeof document !== 'object') {
      return;
    }

    const fields = (document as FirestoreDocument).fields;
    const token = getFirestoreStringField(fields, 'token');
    const type = getFirestoreStringField(fields, 'type');
    if (!token || (type !== 'APNS_VOIP' && type !== 'FCM')) {
      return;
    }

    const deviceToken = { token, type } satisfies DeviceToken;
    if (isDeviceToken(deviceToken)) {
      tokens.set(`${type}:${token}`, deviceToken);
    }
  });

  return [...tokens.values()].slice(0, MAX_DEVICE_TOKENS);
}

async function readJsonWithinLimit(response: Response): Promise<unknown> {
  const contentLength = Number(response.headers.get('Content-Length'));
  if (Number.isFinite(contentLength) && contentLength > FIRESTORE_RESPONSE_LIMIT_BYTES) {
    throw new Error('push-response-too-large');
  }

  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > FIRESTORE_RESPONSE_LIMIT_BYTES) {
    throw new Error('push-response-too-large');
  }

  return JSON.parse(text) as unknown;
}

async function createGoogleAccessToken(config: PushEnvironment): Promise<string> {
  if (!config.firebaseServiceAccountEmail || !config.firebaseServiceAccountPrivateKey) {
    throw new Error('push-provider-not-configured');
  }

  const now = Math.floor(Date.now() / 1_000);
  const key = await importPKCS8(normalizePrivateKey(config.firebaseServiceAccountPrivateKey), 'RS256');
  const assertion = await new SignJWT({ scope: GOOGLE_SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(config.firebaseServiceAccountEmail)
    .setAudience(GOOGLE_TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + GOOGLE_TOKEN_LIFETIME_SECONDS)
    .sign(key);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error('google-access-token-rejected');
  }

  const value = await response.json() as { access_token?: unknown; expires_in?: unknown };
  if (typeof value.access_token !== 'string' || value.access_token.length === 0) {
    throw new Error('google-access-token-invalid');
  }

  const expiresIn = typeof value.expires_in === 'number' && Number.isFinite(value.expires_in)
    ? value.expires_in
    : GOOGLE_TOKEN_LIFETIME_SECONDS;
  const expiresAt = Date.now() + Math.max(60, expiresIn - 60) * 1_000;
  googleAccessTokenCache = {
    cacheKey: config.firebaseServiceAccountEmail,
    token: value.access_token,
    expiresAt,
  };
  return value.access_token;
}

async function getGoogleAccessToken(config: PushEnvironment): Promise<string> {
  if (!config.firebaseServiceAccountEmail || !config.firebaseServiceAccountPrivateKey) {
    throw new Error('push-provider-not-configured');
  }

  const cacheKey = config.firebaseServiceAccountEmail;
  if (googleAccessTokenCache && googleAccessTokenCache.cacheKey === cacheKey && googleAccessTokenCache.expiresAt > Date.now()) {
    return googleAccessTokenCache.token;
  }

  if (pendingGoogleAccessToken?.cacheKey === cacheKey) {
    return pendingGoogleAccessToken.promise;
  }

  const promise = createGoogleAccessToken(config);
  pendingGoogleAccessToken = { cacheKey, promise };
  try {
    return await promise;
  } finally {
    if (pendingGoogleAccessToken?.promise === promise) {
      pendingGoogleAccessToken = null;
    }
  }
}

async function getDeviceTokens(config: PushEnvironment, uid: string, accessToken: string): Promise<DeviceToken[]> {
  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${encodePathSegment(config.firebaseProjectId)}/databases/(default)/documents/users/${encodePathSegment(uid)}/devices`,
  );
  url.searchParams.set('pageSize', String(MAX_DEVICE_TOKENS));

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error('device-token-read-failed');
  }

  return parseDeviceTokens(await readJsonWithinLimit(response));
}

export function createIncomingCallPushEvent(event: CallEvent): IncomingCallPushEvent | null {
  if (event.type !== 'call:invite' || event.payload.kind !== 'call') {
    return null;
  }

  const caller = {
    id: event.from,
    displayName: event.payload.profile.displayName,
    ...(event.payload.profile.photoURL ? { avatarUrl: event.payload.profile.photoURL } : {}),
  };

  return {
    eventId: crypto.randomUUID(),
    serverCallId: event.callId,
    hasVideo: event.payload.callKind === 'video',
    startedAt: new Date(event.timestamp).toISOString(),
    caller,
    metadata: { username: event.payload.profile.username },
  };
}

export function createFcmIncomingCallMessage(event: IncomingCallPushEvent, token: string) {
  return {
    message: {
      token,
      data: {
        messageType: 'incomingCall',
        incomingCall: JSON.stringify(event),
      },
      android: { priority: 'HIGH' },
    },
  };
}

function validateApnsHost(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    (url.hostname !== 'api.push.apple.com' && url.hostname !== 'api.sandbox.push.apple.com')
  ) {
    throw new Error('apns-host-invalid');
  }
  return url.origin;
}

async function getApnsProviderToken(config: PushEnvironment): Promise<string> {
  if (!config.apnsTeamId || !config.apnsKeyId || !config.apnsPrivateKey) {
    throw new Error('apns-provider-not-configured');
  }

  const cacheKey = `${config.apnsTeamId}:${config.apnsKeyId}`;
  if (apnsProviderTokenCache && apnsProviderTokenCache.cacheKey === cacheKey && apnsProviderTokenCache.expiresAt > Date.now()) {
    return apnsProviderTokenCache.token;
  }

  const now = Math.floor(Date.now() / 1_000);
  const key = await importPKCS8(normalizePrivateKey(config.apnsPrivateKey), 'ES256');
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.apnsKeyId, typ: 'JWT' })
    .setIssuer(config.apnsTeamId)
    .setIssuedAt(now)
    .sign(key);

  apnsProviderTokenCache = {
    cacheKey,
    token,
    expiresAt: Date.now() + (APNS_TOKEN_LIFETIME_SECONDS - 60) * 1_000,
  };
  return token;
}

export function createApnsIncomingCallPayload(event: IncomingCallPushEvent) {
  return { incomingCall: event };
}

async function sendFcmIncomingCall(
  config: PushEnvironment,
  accessToken: string,
  token: string,
  event: IncomingCallPushEvent,
): Promise<boolean> {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodePathSegment(config.firebaseProjectId)}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createFcmIncomingCallMessage(event, token)),
    },
  );
  return response.ok;
}

async function sendApnsIncomingCall(
  config: PushEnvironment,
  token: string,
  event: IncomingCallPushEvent,
): Promise<boolean> {
  const providerToken = await getApnsProviderToken(config);
  const normalizedToken = token.replaceAll(/\s+/g, '');
  if (!/^[0-9a-fA-F]{64}$/.test(normalizedToken)) {
    return false;
  }

  const host = validateApnsHost(config.apnsHost);
  const response = await fetch(`${host}/3/device/${normalizedToken}`, {
    method: 'POST',
    headers: {
      Authorization: `bearer ${providerToken}`,
      'Content-Type': 'application/json',
      'apns-topic': `${config.apnsBundleId}.voip`,
      'apns-push-type': 'voip',
      'apns-priority': '10',
      'apns-expiration': '0',
      'apns-collapse-id': event.serverCallId,
    },
    body: JSON.stringify(createApnsIncomingCallPayload(event)),
  });
  return response.ok;
}

export async function dispatchOfflineCallInvitePush(
  env: { FIREBASE_PROJECT_ID: string },
  event: CallEvent,
): Promise<PushDispatchResult> {
  const incomingCall = createIncomingCallPushEvent(event);
  if (!incomingCall) {
    return createPushResult('push-event-not-supported');
  }

  const config = getPushEnvironment(env);
  if (!config.firebaseServiceAccountEmail || !config.firebaseServiceAccountPrivateKey) {
    return createPushResult('push-provider-not-configured');
  }

  try {
    const accessToken = await getGoogleAccessToken(config);
    const deviceTokens = await getDeviceTokens(config, event.to, accessToken);
    if (deviceTokens.length === 0) {
      return createPushResult('no-device-tokens');
    }

    const results = await Promise.all(deviceTokens.map(async (deviceToken) => {
      try {
        if (deviceToken.type === 'FCM') {
          return await sendFcmIncomingCall(config, accessToken, deviceToken.token, incomingCall);
        }

        if (!config.apnsTeamId || !config.apnsKeyId || !config.apnsPrivateKey) {
          return false;
        }
        return await sendApnsIncomingCall(config, deviceToken.token, incomingCall);
      } catch {
        return false;
      }
    }));
    const succeeded = results.filter(Boolean).length;
    return createPushResult(
      succeeded > 0 ? 'push-delivered' : 'push-provider-rejected',
      deviceTokens.length,
      succeeded,
    );
  } catch (error) {
    const code = error instanceof Error && /^[a-z0-9-]+$/.test(error.message)
      ? error.message
      : 'push-dispatch-failed';
    return createPushResult(code);
  }
}
