import { getFirebaseAccessToken } from './push-dispatch';

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 120;
const MAX_RESULTS = 10;
const MAX_RESPONSE_BYTES = 256 * 1024;

type DirectoryEnvironment = {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_SERVICE_ACCOUNT_EMAIL?: string;
  FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
};

type FirestoreStringValue = { stringValue?: unknown };
type FirestoreArrayValue = { values?: FirestoreStringValue[] };
type FirestoreField = FirestoreStringValue & { arrayValue?: FirestoreArrayValue };
type FirestoreDocument = { fields?: Record<string, FirestoreField> };

export type DirectoryProfile = {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string | null;
};

function normalizePhoneNumber(value: string) {
  return value.trim().replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
}

export function normalizeDirectorySearchValue(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.startsWith('@')) {
    return trimmed.slice(1);
  }
  if (trimmed.startsWith('+') || /^[\d\s().-]+$/.test(trimmed)) {
    return normalizePhoneNumber(trimmed);
  }
  return trimmed.replace(/\s+/g, ' ');
}

async function hashSearchValue(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(normalizeDirectorySearchValue(value)),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getStringField(fields: Record<string, FirestoreField> | undefined, name: string) {
  const value = fields?.[name]?.stringValue;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getSearchTokens(fields: Record<string, FirestoreField> | undefined) {
  const values = fields?.searchTokens?.arrayValue?.values;
  return Array.isArray(values)
    ? values.flatMap((value) => typeof value.stringValue === 'string' ? [value.stringValue] : [])
    : [];
}

async function readResponseWithinLimit(response: Response) {
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
    throw new Error('directory-response-too-large');
  }
  return JSON.parse(text) as unknown;
}

export async function searchDirectory(
  env: DirectoryEnvironment,
  query: string,
  requesterUid: string,
): Promise<DirectoryProfile[]> {
  const normalizedQuery = normalizeDirectorySearchValue(query);
  if (normalizedQuery.length < MIN_QUERY_LENGTH || normalizedQuery.length > MAX_QUERY_LENGTH) {
    return [];
  }

  const accessToken = await getFirebaseAccessToken(env);
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'userSearch' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'searchTokens' },
              op: 'ARRAY_CONTAINS',
              value: { stringValue: await hashSearchValue(normalizedQuery) },
            },
          },
          limit: MAX_RESULTS,
        },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`directory-search-failed-${response.status}`);
  }

  const payload = await readResponseWithinLimit(response);
  if (!Array.isArray(payload)) {
    throw new Error('directory-response-invalid');
  }

  return payload.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    const document = (item as { document?: FirestoreDocument }).document;
    const fields = document?.fields;
    const uid = getStringField(fields, 'uid');
    const username = getStringField(fields, 'username');
    const displayName = getStringField(fields, 'displayName');
    if (!uid || uid === requesterUid || !username || !displayName || getSearchTokens(fields).length === 0) {
      return [];
    }

    const photoURLValue = fields?.photoURL?.stringValue;
    const photoURL = typeof photoURLValue === 'string' ? photoURLValue : null;
    return [{ uid, username, displayName, photoURL } satisfies DirectoryProfile];
  });
}
