import { getFirebaseAccessToken } from './push-dispatch';

const MAX_CONTACTS = 500;
const MAX_TOKENS_PER_CONTACT = 8;
const MAX_UNIQUE_TOKENS = 1200;
const MAX_RESULTS_PER_QUERY = 100;
const MAX_QUERY_TOKENS = 30;
const MAX_RESPONSE_BYTES = 256 * 1024;

type DirectoryEnvironment = {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_SERVICE_ACCOUNT_EMAIL?: string;
  FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
};

type FirestoreStringValue = { stringValue?: unknown };
type FirestoreField = FirestoreStringValue;
type FirestoreDocument = { fields?: Record<string, FirestoreField> };

export type DirectoryContactInput = {
  contactId: string;
  tokens: string[];
};

export type DirectoryProfile = {
  uid: string;
  phoneNumber: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
};

export type DirectoryContactMatch = {
  contactId: string;
  profile: DirectoryProfile;
};

function getStringField(fields: Record<string, FirestoreField> | undefined, name: string) {
  const value = fields?.[name]?.stringValue;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

async function readResponseWithinLimit(response: Response) {
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
    throw new Error('directory-response-too-large');
  }
  return JSON.parse(text) as unknown;
}

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function readProfile(item: unknown, requesterUid: string) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const document = (item as { document?: FirestoreDocument }).document;
  const fields = document?.fields;
  const uid = getStringField(fields, 'uid');
  const phoneHash = getStringField(fields, 'phoneHash');
  const phoneNumber = getStringField(fields, 'phoneNumber');
  const displayName = getStringField(fields, 'displayName');
  if (!uid || uid === requesterUid || !phoneHash || !phoneNumber || !displayName) {
    return null;
  }

  const emailValue = fields?.email?.stringValue;
  const photoURLValue = fields?.photoURL?.stringValue;
  return {
    phoneHash,
    profile: {
      uid,
      phoneNumber,
      displayName,
      email: typeof emailValue === 'string' ? emailValue : null,
      photoURL: typeof photoURLValue === 'string' ? photoURLValue : null,
    } satisfies DirectoryProfile,
  };
}

export async function matchDirectoryContacts(
  env: DirectoryEnvironment,
  contacts: DirectoryContactInput[],
  requesterUid: string,
): Promise<DirectoryContactMatch[]> {
  const boundedContacts = contacts
    .slice(0, MAX_CONTACTS)
    .map((contact) => ({
      contactId: contact.contactId.trim().slice(0, 160),
      tokens: [...new Set(contact.tokens)]
        .filter((token) => /^[a-f0-9]{64}$/i.test(token))
        .slice(0, MAX_TOKENS_PER_CONTACT),
    }))
    .filter((contact) => contact.contactId.length > 0 && contact.tokens.length > 0);

  const tokenToContactIds = new Map<string, Set<string>>();
  for (const contact of boundedContacts) {
    for (const token of contact.tokens) {
      const contactIds = tokenToContactIds.get(token) ?? new Set<string>();
      contactIds.add(contact.contactId);
      tokenToContactIds.set(token, contactIds);
    }
  }

  const tokens = [...tokenToContactIds.keys()].slice(0, MAX_UNIQUE_TOKENS);
  if (tokens.length === 0) {
    return [];
  }

  const accessToken = await getFirebaseAccessToken(env);
  const queryUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents:runQuery`;
  const responses = await Promise.all(
    chunk(tokens, MAX_QUERY_TOKENS).map(async (tokenGroup) => {
      const response = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'phoneDirectory' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'phoneHash' },
                op: 'IN',
                value: { arrayValue: { values: tokenGroup.map((token) => ({ stringValue: token })) } },
              },
            },
            limit: MAX_RESULTS_PER_QUERY,
          },
        }),
      });
      if (!response.ok) {
        throw new Error(`directory-match-failed-${response.status}`);
      }
      return readResponseWithinLimit(response);
    }),
  );

  const matches = new Map<string, DirectoryContactMatch>();
  for (const response of responses) {
    if (!Array.isArray(response)) {
      continue;
    }
    for (const item of response) {
      const parsed = readProfile(item, requesterUid);
      if (!parsed) {
        continue;
      }
      for (const contactId of tokenToContactIds.get(parsed.phoneHash) ?? []) {
        matches.set(`${contactId}:${parsed.profile.uid}`, {
          contactId,
          profile: parsed.profile,
        });
      }
    }
  }

  return [...matches.values()].slice(0, MAX_CONTACTS);
}
