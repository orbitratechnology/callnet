import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';
import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';

import type { AuthUser } from '../auth/auth-service';
import { firebaseDb } from '../auth/firebase-app';

export type UserProfile = {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};

const CONTACT_MATCH_PATH = '/contacts/match';
const CONTACT_MATCH_MAX = 500;

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/;

export function normalizeUsername(value: string) {
  return value.trim().replace(/^@/, '').toLowerCase();
}

export function isValidUsername(value: string) {
  return USERNAME_PATTERN.test(value);
}

function fallbackUsername(uid: string) {
  return `u-${uid.toLowerCase()}`;
}

function getDisplayName(user: Pick<AuthUser, 'displayName' | 'email'>) {
  return user.displayName?.trim() || user.email?.split('@')[0]?.trim() || 'user';
}

export function normalizePhoneNumber(value: string) {
  return value.trim().replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
}

export function normalizeContactIdentifier(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.startsWith('@')) {
    return trimmed.slice(1);
  }
  if (trimmed.startsWith('+') || /^[\d\s().-]+$/.test(trimmed)) {
    return normalizePhoneNumber(trimmed);
  }
  return trimmed.replace(/\s+/g, ' ');
}

function getPrefixValues(value: string) {
  const normalized = normalizeContactIdentifier(value);
  if (normalized.length < 2) {
    return [];
  }

  const values = new Set<string>();
  for (let length = 2; length <= normalized.length; length += 1) {
    values.add(normalized.slice(0, length));
  }

  normalized.split(' ').forEach((word) => {
    for (let length = 2; length <= word.length; length += 1) {
      values.add(word.slice(0, length));
    }
  });

  return [...values];
}

async function createDirectorySearchTokens(values: string[]) {
  const normalizedValues = [...new Set(values.map(normalizeContactIdentifier))]
    .filter((value) => value.length >= 2 && value.length <= 120);
  return Promise.all(normalizedValues.map((value) => digestStringAsync(CryptoDigestAlgorithm.SHA256, value)));
}

function toUsernameSeed(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 30)
    .replace(/[._-]+$/g, '');
}

export function suggestUsername(user: Pick<AuthUser, 'uid' | 'displayName' | 'email'>) {
  const seed = toUsernameSeed(getDisplayName(user));
  if (seed.length >= 3 && isValidUsername(seed)) {
    return seed;
  }

  const fallback = toUsernameSeed(`user.${seed}`);
  return isValidUsername(fallback) ? fallback : `user-${user.uid.slice(0, 8).toLowerCase()}`;
}

function usernameCandidates(base: string, uid: string) {
  const candidates = [base];
  for (let suffix = 2; suffix <= 99; suffix += 1) {
    const suffixText = String(suffix);
    const prefix = base.slice(0, 30 - suffixText.length).replace(/[._-]+$/g, '');
    candidates.push(`${prefix}${suffixText}`);
  }

  const uidSuffix = uid.slice(0, 6).toLowerCase();
  const prefix = base.slice(0, 30 - uidSuffix.length - 1).replace(/[._-]+$/g, '');
  candidates.push(`${prefix}-${uidSuffix}`);
  return [...new Set(candidates)].filter(isValidUsername);
}

function isLegacyUsername(username: string, uid: string) {
  return username === fallbackUsername(uid);
}

function profileFromData(data: DocumentData | undefined): UserProfile | null {
  if (!data || typeof data.uid !== 'string' || typeof data.username !== 'string' || typeof data.displayName !== 'string') {
    return null;
  }
  const photoURL = data.photoURL === undefined ? null : data.photoURL;
  if (photoURL !== null && typeof photoURL !== 'string') {
    return null;
  }

  return {
    uid: data.uid,
    username: data.username,
    displayName: data.displayName,
    photoURL,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function ensureUserProfile(user: AuthUser, preferredUsername?: string) {
  const userRef = doc(firebaseDb, 'users', user.uid);
  const requestedUsername = preferredUsername
    ? normalizeUsername(preferredUsername)
    : suggestUsername(user);
  if (preferredUsername && !isValidUsername(requestedUsername)) {
    throw new Error('Choose a valid Callnet username before continuing.');
  }

  const displayName = getDisplayName(user);
  const photoURL = user.photoURL ?? null;
  const candidates = usernameCandidates(requestedUsername, user.uid);

  for (const candidate of candidates) {
    const profile = await runTransaction(firebaseDb, async (transaction) => {
      const profileSnapshot = await transaction.get(userRef);
      const currentProfile = profileFromData(profileSnapshot.data());
      const keepExistingUsername = Boolean(
        currentProfile &&
        isValidUsername(currentProfile.username) &&
        !isLegacyUsername(currentProfile.username, user.uid),
      );
      const username = keepExistingUsername ? currentProfile!.username : candidate;
      const usernameRef = doc(firebaseDb, 'usernames', username);
      const usernameSnapshot = await transaction.get(usernameRef);
      const claimedUid = usernameSnapshot.data()?.uid;

      if (usernameSnapshot.exists() && claimedUid !== user.uid) {
        if (keepExistingUsername) {
          throw new Error('Your Callnet username is no longer available.');
        }
        return null;
      }

      const searchValues = [
        ...getPrefixValues(displayName),
        ...getPrefixValues(username),
        ...(user.email ? [user.email] : []),
        ...(user.phoneNumber ? [user.phoneNumber] : []),
      ];
      const searchTokens = await createDirectorySearchTokens(searchValues);

      if (!currentProfile) {
        transaction.set(userRef, {
          uid: user.uid,
          username,
          displayName,
          photoURL,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else if (
        currentProfile.username !== username ||
        currentProfile.displayName !== displayName ||
        currentProfile.photoURL !== photoURL
      ) {
        transaction.update(userRef, {
          username,
          displayName,
          photoURL,
          updatedAt: serverTimestamp(),
        });
      }

      if (!usernameSnapshot.exists()) {
        transaction.set(usernameRef, { uid: user.uid });
      }

      transaction.set(doc(firebaseDb, 'userSearch', user.uid), {
        uid: user.uid,
        displayName,
        username,
        photoURL,
        searchTokens,
      });

      return {
        uid: user.uid,
        username,
        displayName,
        photoURL,
      } satisfies UserProfile;
    });

    if (profile) {
      return profile;
    }
  }

  throw new Error('That username is already in use. Choose another username.');
}

export async function getUserProfile(uid: string) {
  const snapshot = await getDoc(doc(firebaseDb, 'users', uid));
  return snapshot.exists() ? profileFromData(snapshot.data()) : null;
}

export type ContactMatchRequest = {
  contactId: string;
  tokens: string[];
};

export type ContactMatch = {
  contactId: string;
  profile: UserProfile;
};

export async function matchDeviceContacts(contacts: ContactMatchRequest[], idToken: string): Promise<ContactMatch[]> {
  const boundedContacts = contacts
    .slice(0, CONTACT_MATCH_MAX)
    .map((contact) => ({
      contactId: contact.contactId.trim().slice(0, 160),
      tokens: [...new Set(contact.tokens)].filter((token) => /^[a-f0-9]{64}$/i.test(token)).slice(0, 32),
    }))
    .filter((contact) => contact.contactId.length > 0 && contact.tokens.length > 0);
  if (boundedContacts.length === 0) {
    return [];
  }

  const configuredUrl = process.env.EXPO_PUBLIC_SIGNALING_URL?.trim();
  if (!configuredUrl) {
    throw new Error('Callnet contacts are not configured.');
  }

  const url = new URL(configuredUrl);
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.pathname = CONTACT_MATCH_PATH;
  url.search = '';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contacts: boundedContacts }),
  });
  if (!response.ok) {
    throw new Error(`Callnet contacts failed with status ${response.status}.`);
  }

  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { matches?: unknown }).matches)) {
    throw new Error('Callnet contacts returned an invalid response.');
  }

  return (payload as { matches: unknown[] }).matches.flatMap((match) => {
    if (!match || typeof match !== 'object') {
      return [];
    }
    const contactId = (match as { contactId?: unknown }).contactId;
    const profile = profileFromData((match as { profile?: DocumentData }).profile);
    return typeof contactId === 'string' && profile ? [{ contactId, profile }] : [];
  });
}
