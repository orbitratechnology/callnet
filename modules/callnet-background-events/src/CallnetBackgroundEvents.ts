import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export type PendingCallEndedEvent = {
  eventId: string;
  nativeCallId: string;
  serverCallId: string;
  peerId: string;
  kind: 'voice' | 'video';
  endedAt: number;
};

type CallnetBackgroundEventsModule = {
  getPendingCallEvents(): PendingCallEndedEvent[];
  acknowledgePendingCallEvents(eventIds: string[]): void;
};

const nativeModule =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<CallnetBackgroundEventsModule>('CallnetBackgroundEvents')
    : null;

export function getPendingCallEvents(): PendingCallEndedEvent[] {
  return nativeModule?.getPendingCallEvents() ?? [];
}

export function acknowledgePendingCallEvents(eventIds: string[]): void {
  if (eventIds.length > 0) {
    nativeModule?.acknowledgePendingCallEvents(eventIds);
  }
}
