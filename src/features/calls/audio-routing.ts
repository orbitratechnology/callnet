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

function loadInCallManager() {
  try {
    return require('react-native-incall-manager') as InCallManagerLike;
  } catch {
    throw new Error('react-native-incall-manager is not installed. Install Phase 3 dependencies before enabling WebRTC mode.');
  }
}

export class NativeAudioRoutingAdapter implements AudioRoutingAdapter {
  private manager: InCallManagerLike | null = null;

  start(kind: CallKind) {
    this.manager = loadInCallManager();
    this.manager.start({ media: kind === 'video' ? 'video' : 'audio' });
  }

  setSpeakerEnabled(enabled: boolean) {
    this.manager?.setSpeakerphoneOn(enabled);
  }

  stop() {
    this.manager?.stop();
    this.manager = null;
  }
}
