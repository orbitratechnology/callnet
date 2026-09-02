import type { CallKind } from './call-state';

export interface AudioRoutingAdapter {
  start(kind: CallKind): void;
  setSpeakerEnabled(enabled: boolean): void;
  stop(): void;
}

type InCallManagerLike = {
  start(options?: { media?: 'audio' | 'video' }): void;
  setSpeakerphoneOn(enabled: boolean): void;
  stop(): void;
};

declare const require: (moduleName: string) => unknown;

function unwrapDefault<T>(value: unknown): T {
  if (value && typeof value === 'object' && 'default' in value) {
    return (value as { default: T }).default;
  }

  return value as T;
}

function loadInCallManager() {
  try {
    const manager = unwrapDefault<InCallManagerLike>(require('react-native-incall-manager'));

    if (
      !manager ||
      typeof manager.start !== 'function' ||
      typeof manager.setSpeakerphoneOn !== 'function' ||
      typeof manager.stop !== 'function'
    ) {
      throw new Error('react-native-incall-manager-export-invalid');
    }

    return manager;
  } catch {
    throw new Error('audio-routing-native-module-unavailable');
  }
}

export class NativeAudioRoutingAdapter implements AudioRoutingAdapter {
  private manager: InCallManagerLike | null = null;

  start(kind: CallKind) {
    this.manager = loadInCallManager();
    this.manager.start({ media: kind === 'video' ? 'video' : 'audio' });
  }

  setSpeakerEnabled(enabled: boolean) {
    try {
      this.manager?.setSpeakerphoneOn(enabled);
    } catch {
      // Audio routing is best-effort after the native call has started.
    }
  }

  stop() {
    try {
      this.manager?.stop();
    } catch {
      // Cleanup must not surface an unhandled rejection after a call ends.
    } finally {
      this.manager = null;
    }
  }
}
