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
import { CallColors, Colors, Motion, Radius, Shadows, Spacing, useThemeBackground } from '@/constants/theme';
import { useCall } from '@/features/calls/call-provider';
import type { CallState } from '@/features/calls/call-state';
import { getCallFailureMessage } from '@/features/calls/call-messages';

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
    ? 'Video preview is not available on this device.'
    : remoteStreamUrl
      ? null
      : state === 'connecting'
        ? 'Connecting video…'
        : 'Waiting for video…';

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
              Your video preview
            </ThemedText>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function getStateLabel(state: CallState, direction?: 'incoming' | 'outgoing') {
  if (state === 'outgoing') return 'Calling…';
  if (state === 'ringing') return direction === 'incoming' ? 'Incoming call' : 'Ringing…';
  if (state === 'connecting') return 'Connecting…';
  if (state === 'connected') return 'Connected';
  if (state === 'ending') return 'Ending call…';
  if (state === 'failed') return 'Call ended';
  if (state === 'ended') return 'Call ended';
  return 'Starting call…';
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

function isTerminal(state: CallState | undefined) {
  return state === 'ended' || state === 'failed';
}

function isMediaPermissionFailure(reason?: string) {
  return Boolean(reason && (reason.includes('permission-denied') || /permission.*denied/i.test(reason)));
}

export default function CallScreen() {
  const { personId } = useLocalSearchParams<{ personId?: string }>();
  const insets = useSafeAreaInsets();
  const backgroundColor = useThemeBackground();
  const {
    session,
    localStreamUrl,
    remoteStreamUrl,
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
  const permissionDenied = currentState === 'failed' && isMediaPermissionFailure(failureReason);
  const hasCallOutcome = currentState === 'failed' || Boolean(currentState === 'ended' && failureReason);

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
      <View style={[styles.emptyContainer, { backgroundColor }]}>
        <Stack.Screen options={{ title: 'Call', headerShown: false }} />
        <View style={styles.emptyCopy}>
          <ThemedText variant="title" style={styles.centered}>Choose a person to call</ThemedText>
          <ThemedText variant="body" tone="secondary" style={styles.centered}>
            Choose someone before starting a call.
          </ThemedText>
        </View>
        <Button title="Back" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

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
          title: 'Call',
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: CallColors.background },
        }}
      />

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={toggleControls}
        accessible={false}
        accessibilityLabel="Show or hide call controls"
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
            accessibilityLabel={isActiveCall ? 'End and close call' : 'Close call screen'}
            style={styles.closeButton}
            onPress={closeScreen}
          />
          <ThemedText variant="headline" style={styles.callOnSurfaceText}>Callnet</ThemedText>
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
              ? `You are already calling ${session?.person.name ?? ''}.`
              : getStateLabel(currentState ?? 'idle', session?.direction)}
          </ThemedText>
          {currentState === 'connected' ? (
            <ThemedText variant="headline" style={[styles.centered, styles.callOnSurfaceText]}>
              {formatDuration(duration)}
            </ThemedText>
          ) : null}
        </Animated.View>

        {hasCallOutcome ? (
          <View style={[styles.failureCopy, { top: contentTop + 156 }]}>
            <ThemedText variant="subhead" style={[styles.centered, styles.callSecondaryText]}>
              {getCallFailureMessage(failureReason, session?.kind ?? 'voice')}
            </ThemedText>
            {permissionDenied ? (
              <>
                <ThemedText variant="caption" style={[styles.centered, styles.callSecondaryText]}>
                  {session?.kind === 'video'
                    ? 'Allow camera and microphone access in Settings, then try the call again.'
                    : 'Allow microphone access in Settings, then try the call again.'}
                </ThemedText>
                <Button
                  title="Open Settings"
                  variant="secondary"
                  size="sm"
                  accessibilityHint="Opens Callnet's device permissions"
                  onPress={() => void Linking.openSettings().catch(() => undefined)}
                />
              </>
            ) : null}
          </View>
        ) : null}

        {isBusyWithAnotherPerson || currentState ? (
          <Animated.View
            style={[styles.bottomControls, { bottom: contentBottom }, controlsStyle]}
            pointerEvents={controlsVisible ? 'auto' : 'none'}
          >
            {isBusyWithAnotherPerson ? (
              <Button title="Back" variant="ghost" onPress={() => router.back()} style={styles.wideAction} />
            ) : isIncoming ? (
              <View style={styles.actions}>
                <Button title="Accept call" onPress={() => void acceptIncoming()} style={styles.wideAction} />
                <Button title="Reject" variant="destructive" onPress={reject} style={styles.wideAction} />
              </View>
            ) : isTerminal(currentState) ? (
              <View style={styles.actions}>
                <Button title="Done" variant="ghost" onPress={closeCall} style={styles.wideAction} />
              </View>
            ) : currentState ? (
              <View style={styles.actions}>
                {currentState === 'connected' ? (
                <View style={styles.controlRow}>
                  <IconButton
                    label={session?.isMuted ? 'Unmute' : 'Mute'}
                    accessibilityLabel={session?.isMuted ? 'Unmute microphone' : 'Mute microphone'}
                    active={session?.isMuted}
                    style={[styles.callControlButton, session?.isMuted ? styles.callControlActive : null]}
                    icon={
                      <CallIcon
                        ios={session?.isMuted ? 'mic.slash.fill' : 'mic.fill'}
                        android={session?.isMuted ? 'mic_off' : 'mic'}
                        fallback={session?.isMuted ? 'Unmute' : 'Mute'}
                      />
                    }
                    onPress={toggleMute}
                  />
                  <IconButton
                    label={session?.isSpeakerEnabled ? 'Earpiece' : 'Speaker'}
                    accessibilityLabel={session?.isSpeakerEnabled ? 'Use earpiece' : 'Use speaker'}
                    active={session?.isSpeakerEnabled}
                    style={[styles.callControlButton, session?.isSpeakerEnabled ? styles.callControlActive : null]}
                    icon={
                      <CallIcon
                        ios={session?.isSpeakerEnabled ? 'speaker.fill' : 'hifispeaker.fill'}
                        android={session?.isSpeakerEnabled ? 'volume_up' : 'volume_mute'}
                        fallback={session?.isSpeakerEnabled ? 'Speaker' : 'Earpiece'}
                      />
                    }
                    onPress={toggleSpeaker}
                  />
                  {session?.kind === 'video' ? (
                    <>
                      <IconButton
                        label={session.isCameraEnabled ? 'Camera' : 'Camera off'}
                        accessibilityLabel={session.isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
                        active={!session.isCameraEnabled}
                        style={[styles.callControlButton, !session.isCameraEnabled ? styles.callControlActive : null]}
                        icon={
                          <CallIcon
                            ios={session.isCameraEnabled ? 'camera.fill' : 'video.slash.fill'}
                            android={session.isCameraEnabled ? 'videocam' : 'videocam_off'}
                            fallback={session.isCameraEnabled ? 'Camera' : 'Camera off'}
                          />
                        }
                        onPress={toggleCamera}
                      />
                      <IconButton
                        label="Flip"
                        accessibilityLabel="Switch camera"
                        style={styles.callControlButton}
                        icon={<CallIcon ios="arrow.triangle.2.circlepath.camera" android="cameraswitch" fallback="Flip" />}
                        onPress={switchCamera}
                      />
                    </>
                  ) : null}
                </View>
                ) : null}
                {currentState === 'outgoing' || currentState === 'ringing' || currentState === 'connecting' ? (
                  <>
                    <Button
                      title={currentState === 'ringing' ? 'Cancel call' : 'Cancel'}
                      variant="destructive"
                      onPress={cancel}
                      style={styles.endAction}
                    />
                    {currentState === 'ringing' ? (
                      <Button title="Simulate timeout" variant="ghost" size="sm" onPress={timeout} />
                    ) : null}
                  </>
                ) : (
                  <Button
                    title="End call"
                    variant="destructive"
                    onPress={end}
                    disabled={currentState === 'ending'}
                    style={styles.endAction}
                  />
                )}
              </View>
            ) : null}
          </Animated.View>
        ) : null}
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
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: CallColors.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CallColors.border,
  },
  bottomControls: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: CallColors.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CallColors.border,
    boxShadow: Shadows.floating,
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
    width: '100%',
    padding: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: CallColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CallColors.border,
  },
  callControlButton: {
    width: 56,
    height: 56,
    minWidth: 56,
    minHeight: 56,
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
