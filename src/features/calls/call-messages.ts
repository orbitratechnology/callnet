import type { CallKind } from './call-state';

export function getCallFailureMessage(reason: string | undefined, kind: CallKind): string {
  const value = reason?.toLowerCase() ?? '';

  if (value.includes('peer-busy')) {
    return 'They’re on another call right now.';
  }
  if (value.includes('peer-offline')) {
    return 'They’re not available right now.';
  }
  if (value.includes('timed-out') || value.includes('timeout')) {
    return 'No answer. Try again later.';
  }
  if (value.includes('rejected')) {
    return 'They declined the call.';
  }
  if (value.includes('cancelled') || value.includes('canceled')) {
    return 'Call cancelled.';
  }
  if (value.includes('permission-denied')) {
    return kind === 'video'
      ? 'Allow camera and microphone access to make a video call.'
      : 'Allow microphone access to make a voice call.';
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
    return 'You’re offline. Reconnect to the internet and try again.';
  }

  return 'We couldn’t connect the call. Please try again.';
}

export function getCallConnectionCopy(status: 'connecting' | 'connected' | 'offline') {
  if (status === 'connected') {
    return { label: 'Ready to call', message: 'You can make calls now.' };
  }
  if (status === 'connecting') {
    return { label: 'Getting ready', message: 'Your calls will be ready in a moment.' };
  }
  return { label: 'No connection', message: 'Reconnect to the internet to make calls.' };
}
