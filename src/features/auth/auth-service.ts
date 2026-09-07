import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  GoogleOneTapSignIn,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse,
} from 'react-native-nitro-google-signin';
import { Platform } from 'react-native';

import { firebaseAuth } from './firebase-app';

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
let nativeGoogleConfigured = false;

export type AuthUser = {
  uid: string;
  email: string | null;
  phoneNumber: string | null;
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
    phoneNumber: user.phoneNumber,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

export function getAuthErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code).toLowerCase()
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
    return 'This sign-in option is not available right now.';
  }
  if (code.includes('account-exists-with-different-credential')) {
    return 'That email is already connected to another sign-in option.';
  }
  if (code === '10' || code.includes('developer_error')) {
    return 'Google sign-in is not available right now. Try email instead.';
  }
  if (code === '12501' || code.includes('sign_in_cancelled') || code.includes('popup-closed-by-user')) {
    return 'Sign-in cancelled.';
  }
  if (code === '2' || code.includes('play_services_not_available')) {
    return 'Update Google services on this device, then try again.';
  }
  if (code.includes('too-many-requests')) {
    return 'Too many attempts. Wait a moment and try again.';
  }
  if (code.includes('network-request-failed') || code.includes('unavailable') || code.includes('deadline-exceeded')) {
    return 'You’re offline. Reconnect to the internet and try again.';
  }
  if (code.includes('user-disabled')) {
    return 'This account is not available.';
  }

  return 'We couldn’t complete sign-in. Check your details and try again.';
}

export class FirebaseAuthService implements AuthService {
  getCurrentUser() {
    return mapUser(firebaseAuth.currentUser);
  }

  subscribe(listener: (user: AuthUser | null) => void) {
    return onAuthStateChanged(firebaseAuth, (user) => listener(mapUser(user)));
  }

  async signInWithGoogle() {
    if (Platform.OS === 'web') {
      const result = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
      const user = mapUser(result.user);
      if (!user) {
        throw new Error('Google sign-in did not return a user.');
      }
      return user;
    }

    if (!googleWebClientId) {
      throw new Error('Google Sign-In needs EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in the app environment.');
    }

    if (!nativeGoogleConfigured) {
      GoogleOneTapSignIn.configure({ webClientId: googleWebClientId });
      nativeGoogleConfigured = true;
    }

    await GoogleOneTapSignIn.checkPlayServices(true);
    let response = await GoogleOneTapSignIn.signIn();
    if (isNoSavedCredentialFoundResponse(response)) {
      response = await GoogleOneTapSignIn.createAccount();
    }
    if (isNoSavedCredentialFoundResponse(response)) {
      response = await GoogleOneTapSignIn.presentExplicitSignIn();
    }
    if (!isSuccessResponse(response) || !response.data.idToken) {
      throw new Error('Google sign-in was cancelled.');
    }

    const result = await signInWithCredential(
      firebaseAuth,
      GoogleAuthProvider.credential(response.data.idToken),
    );
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
