import type { CallKind } from './call-state';

export function getCallFailureMessage(reason: string | undefined, kind: CallKind): string {
  const value = reason?.toLowerCase() ?? '';

  if (value.includes('peer-busy')) {
    return 'Contact is already on another call.';
  }
  if (value.includes('peer-offline')) {
    return 'Contact is offline.';
  }
  if (value.includes('timed-out') || value.includes('timeout')) {
    return 'No answer.';
  }
  if (value.includes('rejected')) {
    return 'Call declined.';
  }
  if (value.includes('cancelled') || value.includes('canceled')) {
    return 'Call cancelled.';
  }
  if (value.includes('permission-denied')) {
    return kind === 'video'
      ? 'Camera and microphone access is needed for video calls.'
      : 'Microphone access is needed for voice calls.';
  }
  if (
    value.includes('network') ||
    value.includes('internet') ||
    value.includes('offline') ||
    value.includes('signaling') ||
    value.includes('websocket') ||
    value.includes('reconnect') ||
    value.includes('not-connected')
  ) {
    return 'No internet connection. Check your connection and try again.';
  }

  return 'The call could not connect. Please try again.';
}

export function getCallConnectionCopy(status: 'connecting' | 'connected' | 'offline') {
  if (status === 'connected') {
    return { label: 'Ready to call', message: 'You can make calls now.' };
  }
  if (status === 'connecting') {
    return { label: 'Getting ready', message: 'Your calls will be ready in a moment.' };
  }
  return { label: 'Calls unavailable', message: 'Check your internet connection and try again.' };
}
