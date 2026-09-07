import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';

import type { AuthUser } from '../auth/auth-service';
import { firebaseDb } from '../auth/firebase-app';
import { getSignalingUrl } from '../calls/call-config';
import {
  isValidPhoneNumber,
  normalizePhoneNumber,
} from './phone-number';

export type UserProfile = {
  uid: string;
  phoneNumber: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};

const CONTACT_MATCH_PATH = '/contacts/match';
const CONTACT_MATCH_MAX = 500;

function getDisplayName(user: Pick<AuthUser, 'displayName' | 'email'>) {
  return user.displayName?.trim() || user.email?.split('@')[0]?.trim() || 'Callnet user';
}

function profileFromData(data: DocumentData | undefined): UserProfile | null {
  if (
    !data ||
    typeof data.uid !== 'string' ||
    typeof data.phoneNumber !== 'string' ||
    !isValidPhoneNumber(data.phoneNumber) ||
    typeof data.displayName !== 'string'
  ) {
    return null;
  }

  const email = data.email === undefined ? null : data.email;
  const photoURL = data.photoURL === undefined ? null : data.photoURL;
  if (
    (email !== null && typeof email !== 'string') ||
    (photoURL !== null && typeof photoURL !== 'string')
  ) {
    return null;
  }

  return {
    uid: data.uid,
    phoneNumber: data.phoneNumber,
    displayName: data.displayName,
    email,
    photoURL,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export { getDefaultPhoneCountry, isValidPhoneNumber, normalizePhoneNumber } from './phone-number';

export async function hashPhoneNumber(value: string) {
  const normalized = normalizePhoneNumber(value);
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, normalized);
}

export async function ensureUserProfile(user: AuthUser, phoneNumber: string) {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  if (!isValidPhoneNumber(normalizedPhoneNumber)) {
    throw new Error('Enter a valid phone number.');
  }

  const phoneHash = await hashPhoneNumber(normalizedPhoneNumber);
  const userRef = doc(firebaseDb, 'users', user.uid);
  const phoneDirectoryRef = doc(firebaseDb, 'phoneDirectory', normalizedPhoneNumber);
  const displayName = getDisplayName(user);
  const email = user.email ?? null;
  const photoURL = user.photoURL ?? null;

  return runTransaction(firebaseDb, async (transaction) => {
    const profileSnapshot = await transaction.get(userRef);
    const currentData = profileSnapshot.data();

    const profile = {
      uid: user.uid,
      phoneNumber: normalizedPhoneNumber,
      displayName,
      email,
      photoURL,
      createdAt: currentData?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    transaction.set(userRef, profile);
    transaction.set(phoneDirectoryRef, {
      uid: user.uid,
      phoneHash,
      phoneNumber: normalizedPhoneNumber,
      displayName,
      email,
      photoURL,
      updatedAt: serverTimestamp(),
    });

    return profile satisfies UserProfile;
  }).catch((error: unknown) => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'permission-denied'
    ) {
      throw new Error('That phone number is already linked to another account.');
    }
    throw error;
  });
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
      tokens: [...new Set(contact.tokens)]
        .filter((token) => /^[a-f0-9]{64}$/i.test(token))
        .slice(0, 8),
    }))
    .filter((contact) => contact.contactId.length > 0 && contact.tokens.length > 0);
  if (boundedContacts.length === 0) {
    return [];
  }

  const url = new URL(getSignalingUrl());
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
    if (response.status === 401) {
      throw new Error('Your session has expired. Sign in again to check your contacts.');
    }
    if (response.status >= 500) {
      throw new Error('Callnet contacts are temporarily unavailable.');
    }
    throw new Error('Callnet could not check your contacts.');
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
