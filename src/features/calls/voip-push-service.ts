import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { firebaseDb } from '../auth/firebase-app';
import {
  nativeCallUi,
  type VoipPushToken,
} from './native-call-ui';

const DEVICE_ID_KEY = 'callnet:device-id:v1';
let deviceIdPromise: Promise<string> | null = null;

declare const require: (moduleName: string) => unknown;

function createDeviceId() {
  try {
    const crypto = require('expo-crypto') as { randomUUID?: () => string };
    const uuid = crypto.randomUUID?.();
    if (uuid) {
      return uuid;
    }
  } catch {
    // The native package is optional until the next development client build.
  }

  return `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getDeviceId() {
  if (!deviceIdPromise) {
    deviceIdPromise = AsyncStorage.getItem(DEVICE_ID_KEY).then(async (stored) => {
      if (stored) {
        return stored;
      }

      const created = createDeviceId();
      await AsyncStorage.setItem(DEVICE_ID_KEY, created);
      return created;
    });
  }

  return deviceIdPromise;
}

async function persistToken(uid: string, token: VoipPushToken) {
  const deviceId = await getDeviceId();
  await setDoc(
    doc(firebaseDb, 'users', uid, 'devices', deviceId),
    {
      token: token.token,
      type: token.type,
      platform: Platform.OS,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function setupVoipPushForUser(uid: string) {
  nativeCallUi.registerVoipPush();

  const save = (token: VoipPushToken | null) => {
    if (token) {
      void persistToken(uid, token).catch(() => undefined);
    }
  };

  save(nativeCallUi.getVoipPushToken());
  const unsubscribe = nativeCallUi.subscribeVoipPushToken(save);
  return unsubscribe;
}
