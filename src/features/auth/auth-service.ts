import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { Platform } from 'react-native';

import { firebaseAuth } from './firebase-app';

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

export interface AuthService {
  getCurrentUser(): AuthUser | null;
  subscribe(listener: (user: AuthUser | null) => void): () => void;
  signInWithGoogle(): Promise<AuthUser>;
  signInWithEmail(email: string, password: string): Promise<AuthUser>;
  createEmailAccount(email: string, password: string, displayName: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  getIdToken(forceRefresh?: boolean): Promise<string>;
}

function mapUser(user: FirebaseUser | null): AuthUser | null {
  if (!user) {
    return null;
  }

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

export function getAuthErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';

  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'That email or password is not correct.';
  }
  if (code.includes('email-already-in-use')) {
    return 'An account with that email already exists.';
  }
  if (code.includes('weak-password')) {
    return 'Choose a stronger password with at least six characters.';
  }
  if (code.includes('invalid-email')) {
    return 'Enter a valid email address.';
  }
  if (code.includes('operation-not-allowed')) {
    return 'This sign-in method is not enabled for Callnet yet.';
  }

  return error instanceof Error ? error.message : 'Authentication failed. Please try again.';
}

export class FirebaseAuthService implements AuthService {
  getCurrentUser() {
    return mapUser(firebaseAuth.currentUser);
  }

  subscribe(listener: (user: AuthUser | null) => void) {
    return onAuthStateChanged(firebaseAuth, (user) => listener(mapUser(user)));
  }

  async signInWithGoogle() {
    if (Platform.OS !== 'web') {
      throw new Error('Native Google sign-in needs platform OAuth client IDs before it can be enabled on this build.');
    }

    const result = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
    const user = mapUser(result.user);
    if (!user) {
      throw new Error('Google sign-in did not return a user.');
    }
    return user;
  }

  async signInWithEmail(email: string, password: string) {
    const result = await signInWithEmailAndPassword(firebaseAuth, email, password);
    const user = mapUser(result.user);
    if (!user) {
      throw new Error('Email sign-in did not return a user.');
    }
    return user;
  }

  async createEmailAccount(email: string, password: string, displayName: string) {
    const result = await createUserWithEmailAndPassword(firebaseAuth, email, password);
    if (displayName.trim()) {
      await updateProfile(result.user, { displayName: displayName.trim() });
    }
    const user = mapUser(result.user);
    if (!user) {
      throw new Error('Account creation did not return a user.');
    }
    return user;
  }

  async signOut() {
    await firebaseSignOut(firebaseAuth);
  }

  async getIdToken(forceRefresh = false) {
    const user = firebaseAuth.currentUser;
    if (!user) {
      throw new Error('Sign in before connecting to calls.');
    }
    return user.getIdToken(forceRefresh);
  }
}

export const authService = new FirebaseAuthService();
