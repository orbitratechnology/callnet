import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useEffect, useState, type ComponentType } from 'react';
import {
  AccessibilityInfo,
  Linking,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { CallColors, Colors, Motion, Radius, Spacing } from '@/constants/theme';
import { useCall } from '@/features/calls/call-provider';
import type { CallKind, CallState } from '@/features/calls/call-state';
import { strings } from '@/localization/strings';
import { redactDiagnostic } from '../../shared/diagnostics';

type RtcViewProps = {
  streamURL: string;
  style?: StyleProp<ViewStyle>;
  objectFit?: 'cover' | 'contain';
  mirror?: boolean;
};

type RtcViewModule = { RTCView?: ComponentType<RtcViewProps> };

function CallIcon({ ios, android, fallback }: { ios: SFSymbol; android: AndroidSymbol; fallback: string }) {
  return (
    <SymbolView
      name={{ ios, android, web: android }}
      size={22}
      tintColor={CallColors.controlForeground}
      fallback={<ThemedText variant="headline" style={styles.controlIconFallback}>{fallback}</ThemedText>}
    />
  );
}

declare const require: (moduleName: string) => unknown;

function getRtcView() {
  try {
    return (require('@livekit/react-native-webrtc') as RtcViewModule).RTCView;
  } catch {
    return undefined;
  }
}

function VideoSurface({
  localStreamUrl,
  remoteStreamUrl,
  initials,
  photoURL,
  state,
  reduceMotion,
}: {
  localStreamUrl: string | null;
  remoteStreamUrl: string | null;
  initials: string;
  photoURL?: string | null;
  state: CallState;
  reduceMotion: boolean;
}) {
  const RTCView = getRtcView();
  const remoteProgress = useSharedValue(remoteStreamUrl ? 1 : 0);
  const localProgress = useSharedValue(localStreamUrl ? 1 : 0);

  useEffect(() => {
    remoteProgress.value = withTiming(remoteStreamUrl ? 1 : 0, {
      duration: reduceMotion ? 0 : Motion.slow,
      easing: Easing.out(Easing.cubic),
    });
  }, [reduceMotion, remoteProgress, remoteStreamUrl]);

  useEffect(() => {
    localProgress.value = withTiming(localStreamUrl ? 1 : 0, {
      duration: reduceMotion ? 0 : Motion.base,
      easing: Easing.out(Easing.cubic),
    });
  }, [localProgress, localStreamUrl, reduceMotion]);

  const remoteStyle = useAnimatedStyle(() => ({
    opacity: remoteProgress.value,
    transform: [{ scale: 0.985 + remoteProgress.value * 0.015 }],
  }));
  const localStyle = useAnimatedStyle(() => ({
    opacity: localProgress.value,
    transform: [{ scale: 0.96 + localProgress.value * 0.04 }],
  }));

  const placeholderMessage = !RTCView
    ? strings.call.video.developmentClientRequired
    : remoteStreamUrl
      ? null
      : state === 'connecting'
        ? strings.call.video.connecting
        : strings.call.video.waiting;

  return (
    <View style={styles.videoStage} pointerEvents="none">
      <View style={styles.videoBackdrop} />
      {RTCView && remoteStreamUrl ? (
        <Animated.View style={[StyleSheet.absoluteFill, remoteStyle]}>
          <RTCView streamURL={remoteStreamUrl} style={styles.remoteVideo} objectFit="cover" />
        </Animated.View>
      ) : null}
      {placeholderMessage ? (
        <View style={styles.videoPlaceholder}>
          <Avatar initials={initials} photoURL={photoURL} size="lg" />
          <ThemedText variant="subhead" style={styles.callSecondaryText}>
            {placeholderMessage}
          </ThemedText>
        </View>
      ) : null}
      {RTCView && localStreamUrl ? (
        <Animated.View style={[styles.localVideo, localStyle]}>
          <RTCView streamURL={localStreamUrl} style={styles.videoFrame} objectFit="cover" mirror />
          <View style={styles.previewBadge}>
            <ThemedText variant="caption" style={styles.previewBadgeText}>
              {strings.call.video.localPreview}
            </ThemedText>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function getStateLabel(state: CallState, direction?: 'incoming' | 'outgoing') {
  if (state === 'outgoing') return strings.call.states.outgoing;
  if (state === 'ringing') return direction === 'incoming' ? strings.call.states.incoming : strings.call.states.ringing;
  if (state === 'connecting') return strings.call.states.connecting;
  if (state === 'connected') return strings.call.states.connected;
  if (state === 'ending') return strings.call.states.ending;
  if (state === 'failed') return strings.call.states.failed;
  if (state === 'ended') return strings.call.states.ended;
  return strings.call.states.ready;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

function isTerminal(state: CallState | undefined) {
  return state === 'ended' || state === 'failed';
}

export default function CallScreen() {
  const { personId } = useLocalSearchParams<{ personId?: string }>();
  const insets = useSafeAreaInsets();
  const {
    session,
    transportMode,
    transportError,
    localStreamUrl,
    remoteStreamUrl,
    startOutgoing,
    acceptIncoming,
    reject,
    cancel,
    timeout,
    end,
    resetCall,
    toggleMute,
    toggleSpeaker,
    toggleCamera,
    switchCamera,
    contacts,
  } = useCall();
  const selectedPerson = contacts.find((person) => person.id === personId) ?? session?.person;
  const [now, setNow] = useState(() => Date.now());
  const [controlsVisible, setControlsVisible] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const controlsProgress = useSharedValue(1);

  useEffect(() => {
    if (session?.state !== 'connected') return;

    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [session?.state]);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const isCurrentSession = selectedPerson ? session?.person.id === selectedPerson.id : false;
  const currentState = isCurrentSession ? session?.state : undefined;
  const isIncoming = isCurrentSession && session?.direction === 'incoming' && currentState === 'ringing';
  const isBusyWithAnotherPerson = Boolean(session && !isTerminal(session.state) && !isCurrentSession);
  const isReady = !session || !isCurrentSession;
  const isVideoCall = Boolean(
    session?.kind === 'video' &&
      isCurrentSession &&
      currentState &&
      currentState !== 'idle' &&
      !isTerminal(currentState),
  );
  const isActiveCall = Boolean(currentState && currentState !== 'idle' && !isTerminal(currentState));
  const duration = session?.connectedAt ? Math.max(0, Math.floor((now - session.connectedAt) / 1000)) : 0;
  const failureReason = session?.failureReason;
  const permissionDenied = currentState === 'failed' && failureReason?.includes('permission');
  const peerBusy = failureReason?.includes('peer-busy');
  const diagnostic = failureReason ? redactDiagnostic(failureReason) : null;

  useEffect(() => {
    if (!isActiveCall || currentState !== 'connected') {
      setControlsVisible(true);
      return;
    }

    const timer = setTimeout(() => setControlsVisible(false), 4500);
    return () => clearTimeout(timer);
  }, [currentState, isActiveCall, session?.callId]);

  useEffect(() => {
    controlsProgress.value = withTiming(controlsVisible ? 1 : 0, {
      duration: reduceMotion ? 0 : Motion.base,
      easing: Easing.out(Easing.cubic),
    });
  }, [controlsProgress, controlsVisible, reduceMotion]);

  const controlsStyle = useAnimatedStyle(() => ({
    opacity: controlsProgress.value,
    transform: [{ translateY: (1 - controlsProgress.value) * 16 }],
  }));

  if (!selectedPerson) {
    return (
      <View style={styles.emptyContainer}>
        <Stack.Screen options={{ title: strings.call.screenTitle, headerShown: false }} />
        <View style={styles.emptyCopy}>
          <ThemedText variant="title" style={styles.centered}>{strings.call.noPersonSelected}</ThemedText>
          <ThemedText variant="body" tone="secondary" style={styles.centered}>
            {strings.call.chooseSomeone}
          </ThemedText>
        </View>
        <Button title={strings.call.back} variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  const startCall = (kind: CallKind) => {
    void startOutgoing(selectedPerson, kind);
  };

  const closeCall = () => {
    resetCall();
    router.back();
  };

  const closeScreen = () => {
    if (currentState && !isTerminal(currentState) && currentState !== 'idle') {
      if (currentState === 'outgoing' || currentState === 'ringing' || currentState === 'connecting') {
        void cancel();
      } else if (currentState === 'connected') {
        void end();
      }
    }
    router.back();
  };

  const toggleControls = () => setControlsVisible((visible) => !visible);
  const contentTop = insets.top + Spacing.sm;
  const contentBottom = insets.bottom + Spacing.md;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: strings.call.screenTitle,
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: CallColors.background },
        }}
      />

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={toggleControls}
        accessible={false}
        accessibilityLabel={strings.call.controls.toggleControls}
      >
        {isVideoCall ? (
          <VideoSurface
            localStreamUrl={localStreamUrl}
            remoteStreamUrl={remoteStreamUrl}
            initials={selectedPerson.initials}
            photoURL={selectedPerson.photoURL}
            state={currentState ?? 'connecting'}
            reduceMotion={reduceMotion}
          />
        ) : (
          <View style={styles.voiceBackdrop} />
        )}
      </Pressable>

      <View style={styles.overlay} pointerEvents="box-none">
        <Animated.View
          style={[styles.topBar, { top: contentTop }, controlsStyle]}
          pointerEvents={controlsVisible ? 'auto' : 'none'}
        >
          <IconButton
            label="×"
            accessibilityLabel={isActiveCall ? strings.call.endAndClose : strings.call.closeScreen}
            style={styles.closeButton}
            onPress={closeScreen}
          />
          <ThemedText variant="headline" style={styles.callOnSurfaceText}>{strings.call.appName}</ThemedText>
          <View style={styles.topBarSpacer} />
        </Animated.View>

        <Animated.View
          style={[
            styles.identity,
            isVideoCall ? styles.videoIdentity : styles.voiceIdentity,
            { top: isVideoCall ? contentTop + 64 : '30%' },
            controlsStyle,
          ]}
          pointerEvents="none"
        >
          {!isVideoCall ? (
            <Avatar initials={selectedPerson.initials} photoURL={selectedPerson.photoURL} size="lg" />
          ) : null}
          <ThemedText variant="title" style={[styles.centered, styles.callOnSurfaceText]}>
            {selectedPerson.name}
          </ThemedText>
          <ThemedText variant="body" style={[styles.centered, styles.callSecondaryText]}>
            {isBusyWithAnotherPerson
              ? strings.call.alreadyCalling(session?.person.name ?? '')
              : getStateLabel(currentState ?? 'idle', session?.direction)}
          </ThemedText>
          {currentState === 'connected' ? (
            <ThemedText variant="headline" style={[styles.centered, styles.callOnSurfaceText]}>
              {formatDuration(duration)}
            </ThemedText>
          ) : null}
        </Animated.View>

        {currentState === 'failed' ? (
          <View style={[styles.failureCopy, { top: contentTop + 156 }]}>
            <ThemedText variant="subhead" style={[styles.centered, styles.callSecondaryText]}>
              {peerBusy
                ? strings.call.failures.peerBusy
                : permissionDenied
                  ? strings.call.failures.permissionDenied
                  : transportMode === 'webrtc'
                    ? strings.call.failures.authenticated
                    : strings.call.failures.demo}
            </ThemedText>
            {permissionDenied ? (
              <>
                <ThemedText variant="caption" style={[styles.centered, styles.callSecondaryText]}>
                  {strings.call.failures.permissionHint}
                </ThemedText>
                <Button
                  title={strings.call.actions.openSettings}
                  variant="secondary"
                  size="sm"
                  accessibilityHint={strings.call.actions.openSettingsHint}
                  onPress={() => void Linking.openSettings().catch(() => undefined)}
                />
              </>
            ) : null}
            {__DEV__ && diagnostic && !permissionDenied ? (
              <ThemedText variant="caption" style={[styles.centered, styles.callSecondaryText]}>
                {strings.call.diagnostics(diagnostic)}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        {transportError ? (
          <ThemedText
            variant="caption"
            style={[styles.transportError, styles.callSecondaryText, { top: contentTop + 152 }]}
          >
            {transportError}
          </ThemedText>
        ) : null}

        <Animated.View
          style={[styles.bottomControls, { bottom: contentBottom }, controlsStyle]}
          pointerEvents={controlsVisible ? 'auto' : 'none'}
        >
          {isBusyWithAnotherPerson ? (
            <Button title={strings.call.back} variant="ghost" onPress={() => router.back()} style={styles.wideAction} />
          ) : isIncoming ? (
            <View style={styles.actions}>
              <Button title={strings.call.actions.accept} onPress={() => void acceptIncoming()} style={styles.wideAction} />
              <Button title={strings.call.actions.reject} variant="destructive" onPress={reject} style={styles.wideAction} />
            </View>
          ) : isTerminal(currentState) ? (
            <View style={styles.actions}>
              <Button title={strings.call.done} variant="ghost" onPress={closeCall} style={styles.wideAction} />
            </View>
          ) : isReady ? (
            <View style={styles.actions}>
              <Button title={strings.call.actions.voiceCall} onPress={() => startCall('voice')} style={styles.wideAction} />
              <Button title={strings.call.actions.videoCall} variant="secondary" onPress={() => startCall('video')} style={styles.wideAction} />
              <Button title={strings.call.back} variant="ghost" onPress={() => router.back()} style={styles.wideAction} />
            </View>
          ) : (
            <View style={styles.actions}>
              {currentState === 'connected' ? (
                <View style={styles.controlRow}>
                  <IconButton
                    label={session?.isMuted ? strings.call.controls.unmute : strings.call.controls.mute}
                    accessibilityLabel={session?.isMuted ? strings.call.controls.unmuteMicrophone : strings.call.controls.microphone}
                    active={session?.isMuted}
                    style={[styles.callControlButton, session?.isMuted ? styles.callControlActive : null]}
                    icon={
                      <CallIcon
                        ios={session?.isMuted ? 'mic.slash.fill' : 'mic.fill'}
                        android={session?.isMuted ? 'mic_off' : 'mic'}
                        fallback={session?.isMuted ? strings.call.controls.unmute : strings.call.controls.mute}
                      />
                    }
                    onPress={toggleMute}
                  />
                  <IconButton
                    label={session?.isSpeakerEnabled ? strings.call.controls.earpiece : strings.call.controls.speaker}
                    accessibilityLabel={session?.isSpeakerEnabled ? strings.call.controls.useEarpiece : strings.call.controls.useSpeaker}
                    active={session?.isSpeakerEnabled}
                    style={[styles.callControlButton, session?.isSpeakerEnabled ? styles.callControlActive : null]}
                    icon={
                      <CallIcon
                        ios={session?.isSpeakerEnabled ? 'speaker.fill' : 'hifispeaker.fill'}
                        android={session?.isSpeakerEnabled ? 'volume_up' : 'volume_mute'}
                        fallback={session?.isSpeakerEnabled ? strings.call.controls.speaker : strings.call.controls.earpiece}
                      />
                    }
                    onPress={toggleSpeaker}
                  />
                  {session?.kind === 'video' ? (
                    <>
                      <IconButton
                        label={session.isCameraEnabled ? strings.call.controls.camera : strings.call.controls.cameraOff}
                        accessibilityLabel={session.isCameraEnabled ? strings.call.controls.turnCameraOff : strings.call.controls.turnCameraOn}
                        active={!session.isCameraEnabled}
                        style={[styles.callControlButton, !session.isCameraEnabled ? styles.callControlActive : null]}
                        icon={
                          <CallIcon
                            ios={session.isCameraEnabled ? 'camera.fill' : 'video.slash.fill'}
                            android={session.isCameraEnabled ? 'videocam' : 'videocam_off'}
                            fallback={session.isCameraEnabled ? strings.call.controls.camera : strings.call.controls.cameraOff}
                          />
                        }
                        onPress={toggleCamera}
                      />
                      <IconButton
                        label={strings.call.controls.flip}
                        accessibilityLabel={strings.call.controls.switchCamera}
                        style={styles.callControlButton}
                        icon={<CallIcon ios="arrow.triangle.2.circlepath.camera" android="cameraswitch" fallback={strings.call.controls.flip} />}
                        onPress={switchCamera}
                      />
                    </>
                  ) : null}
                </View>
              ) : null}
              {currentState === 'outgoing' || currentState === 'ringing' || currentState === 'connecting' ? (
                <>
                  <Button
                    title={currentState === 'ringing' ? strings.call.actions.cancelCall : strings.call.actions.cancel}
                    variant="destructive"
                    onPress={cancel}
                    style={styles.endAction}
                  />
                  {currentState === 'ringing' ? (
                    <Button title={strings.call.actions.simulateTimeout} variant="ghost" size="sm" onPress={timeout} />
                  ) : null}
                </>
              ) : (
                <Button
                  title={strings.call.actions.end}
                  variant="destructive"
                  onPress={end}
                  disabled={currentState === 'ending'}
                  style={styles.endAction}
                />
              )}
            </View>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CallColors.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'space-between',
    padding: Spacing.xl,
    paddingTop: Spacing.xxl,
    backgroundColor: Colors.systemBackground,
  },
  emptyCopy: {
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  voiceBackdrop: {
    flex: 1,
    backgroundColor: CallColors.background,
  },
  topBar: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarSpacer: { width: 44, height: 44 },
  closeButton: {
    backgroundColor: CallColors.surface,
    borderColor: CallColors.border,
  },
  identity: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  voiceIdentity: {
    padding: Spacing.lg,
  },
  videoIdentity: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: CallColors.surface,
  },
  centered: { textAlign: 'center' },
  callOnSurfaceText: { color: CallColors.onSurface },
  callSecondaryText: { color: CallColors.onSurfaceSecondary },
  failureCopy: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  transportError: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    textAlign: 'center',
  },
  bottomControls: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    alignItems: 'center',
  },
  actions: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  wideAction: {
    width: '100%',
  },
  endAction: {
    width: '100%',
    borderRadius: Radius.full,
    backgroundColor: CallColors.endCall,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: CallColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CallColors.border,
  },
  callControlButton: {
    minWidth: 48,
    minHeight: 48,
    backgroundColor: CallColors.controlBackground,
    borderColor: 'transparent',
  },
  callControlActive: {
    backgroundColor: '#CBECE4',
  },
  controlIconFallback: { color: CallColors.controlForeground },
  videoStage: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: CallColors.background,
  },
  videoBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: CallColors.background,
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  localVideo: {
    position: 'absolute',
    right: Spacing.md,
    top: Spacing.md,
    width: 112,
    height: 160,
    overflow: 'hidden',
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: CallColors.onSurface,
    backgroundColor: CallColors.surfaceStrong,
  },
  videoFrame: {
    width: '100%',
    height: '100%',
  },
  previewBadge: {
    position: 'absolute',
    left: Spacing.xs,
    right: Spacing.xs,
    bottom: Spacing.xs,
    alignItems: 'center',
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: CallColors.surfaceStrong,
  },
  previewBadgeText: { color: CallColors.onSurface },
});
