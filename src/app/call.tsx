import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { useEffect, useState, type ComponentType } from 'react';
import { Linking, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { useCall } from '@/features/calls/call-provider';
import type { CallKind, CallState } from '@/features/calls/call-state';
import { Colors, Radius, Spacing } from '@/constants/theme';

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
      tintColor={Colors.label}
      fallback={<ThemedText variant="headline">{fallback}</ThemedText>}
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

function VideoSurface({ localStreamUrl, remoteStreamUrl }: { localStreamUrl: string | null; remoteStreamUrl: string | null }) {
  if (!localStreamUrl && !remoteStreamUrl) {
    return null;
  }

  const RTCView = getRtcView();
  if (!RTCView) {
    return (
      <View style={styles.videoStage}>
        <ThemedText variant="subhead" tone="secondary">Video preview requires the WebRTC development client.</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.videoStage}>
      {remoteStreamUrl ? (
        <RTCView streamURL={remoteStreamUrl} style={styles.remoteVideo} objectFit="cover" />
      ) : (
        <ThemedText variant="subhead" tone="secondary">Waiting for video…</ThemedText>
      )}
      {localStreamUrl ? (
        <RTCView streamURL={localStreamUrl} style={styles.localVideo} objectFit="cover" mirror />
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
  if (state === 'failed') return 'Call failed';
  if (state === 'ended') return 'Call ended';
  return 'Ready to call';
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

  useEffect(() => {
    if (session?.state !== 'connected') {
      return;
    }

    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [session?.state]);

  if (!selectedPerson) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Call', headerShown: false }} />
        <View style={styles.identity}>
          <ThemedText variant="title" style={styles.centered}>No person selected</ThemedText>
          <ThemedText variant="body" tone="secondary" style={styles.centered}>
            Choose someone before starting a call.
          </ThemedText>
        </View>
        <Button title="Back" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  const isCurrentSession = session?.person.id === selectedPerson.id;
  const currentState = isCurrentSession ? session?.state : undefined;
  const isIncoming = isCurrentSession && session?.direction === 'incoming' && currentState === 'ringing';
  const isBusyWithAnotherPerson = Boolean(session && !isTerminal(session.state) && !isCurrentSession);
  const isReady = !session || !isCurrentSession;
  const duration = session?.connectedAt ? Math.max(0, Math.floor((now - session.connectedAt) / 1000)) : 0;
  const failureReason = session?.failureReason;
  const permissionDenied = currentState === 'failed' && failureReason?.includes('permission');

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

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Call', headerShown: false }} />
      <View style={styles.topBar}>
        <IconButton
          label="×"
          accessibilityLabel={currentState && !isTerminal(currentState) && currentState !== 'idle' ? 'End and close call' : 'Close call screen'}
          onPress={closeScreen}
        />
        <ThemedText variant="headline">Callnet</ThemedText>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.identity}>
        <Avatar initials={selectedPerson.initials} photoURL={selectedPerson.photoURL} size="lg" />
        <ThemedText variant="title" style={styles.centered}>{selectedPerson.name}</ThemedText>
        <ThemedText variant="body" tone="secondary" style={styles.centered}>
          {isBusyWithAnotherPerson
            ? `You are already calling ${session?.person.name}.`
            : getStateLabel(currentState ?? 'idle', session?.direction)}
        </ThemedText>
        {currentState === 'connected' ? (
          <ThemedText variant="headline" tone="brand" style={styles.centered}>
            {formatDuration(duration)}
          </ThemedText>
        ) : null}
        {currentState === 'failed' ? (
          <View style={styles.failureCopy}>
            <ThemedText variant="subhead" tone="secondary" style={styles.centered}>
              {permissionDenied
              ? 'Microphone or camera permission was denied.'
              : transportMode === 'webrtc'
                ? 'The authenticated call could not connect.'
                : 'The demo call could not connect.'}
            </ThemedText>
            {permissionDenied ? (
              <>
                <ThemedText variant="caption" tone="secondary" style={styles.centered}>
                  Allow access in device settings, then try the call again.
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
            {__DEV__ && failureReason && !permissionDenied ? (
              <ThemedText variant="caption" tone="secondary" style={styles.centered}>
                Diagnostic: {failureReason}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
        {transportError ? (
          <ThemedText variant="caption" tone="secondary" style={styles.centered}>
            {transportError}
          </ThemedText>
        ) : null}
      </View>

      {session?.kind === 'video' && currentState === 'connected' ? (
        <VideoSurface localStreamUrl={localStreamUrl} remoteStreamUrl={remoteStreamUrl} />
      ) : null}

      {isBusyWithAnotherPerson ? (
        <Button title="Back" variant="ghost" onPress={() => router.back()} />
      ) : isIncoming ? (
        <View style={styles.actions}>
          <Button title="Accept call" onPress={() => void acceptIncoming()} />
          <Button title="Reject" variant="destructive" onPress={reject} />
        </View>
      ) : isTerminal(currentState) ? (
        <View style={styles.actions}>
          <Button title="Done" variant="ghost" onPress={closeCall} />
        </View>
      ) : isReady ? (
        <View style={styles.actions}>
          <Button title="Voice call" onPress={() => startCall('voice')} />
          <Button title="Video call" variant="secondary" onPress={() => startCall('video')} />
          <Button title="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      ) : (
        <View style={styles.actions}>
          {currentState === 'connected' ? (
            <View style={styles.controlRow}>
              <IconButton
                label={session?.isMuted ? 'Unmute' : 'Mute'}
                accessibilityLabel={session?.isMuted ? 'Unmute microphone' : 'Mute microphone'}
                active={session?.isMuted}
                icon={
                  <CallIcon
                    ios={session?.isMuted ? 'mic.slash.fill' : 'mic.fill'}
                    android={session?.isMuted ? 'mic_off' : 'mic'}
                    fallback={session?.isMuted ? 'Muted' : 'Mic'}
                  />
                }
                onPress={toggleMute}
              />
              <IconButton
                label={session?.isSpeakerEnabled ? 'Earpiece' : 'Speaker'}
                accessibilityLabel={session?.isSpeakerEnabled ? 'Use earpiece' : 'Use speaker'}
                active={session?.isSpeakerEnabled}
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
                    icon={<CallIcon ios="arrow.triangle.2.circlepath.camera" android="cameraswitch" fallback="Flip" />}
                    onPress={switchCamera}
                  />
                </>
              ) : null}
            </View>
          ) : null}
          {currentState === 'outgoing' || currentState === 'ringing' || currentState === 'connecting' ? (
            <>
              <Button title={currentState === 'ringing' ? 'Cancel call' : 'Cancel'} variant="destructive" onPress={cancel} />
              {currentState === 'ringing' ? (
                <Button title="Simulate timeout" variant="ghost" size="sm" onPress={timeout} />
              ) : null}
            </>
          ) : (
            <Button title="End call" variant="destructive" onPress={end} disabled={currentState === 'ending'} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: Spacing.xl,
    paddingTop: Spacing.xxl,
    backgroundColor: Colors.systemBackground,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topBarSpacer: { width: 40, height: 40 },
  identity: {
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    backgroundColor: Colors.secondaryBackground,
  },
  centered: { textAlign: 'center' },
  failureCopy: { alignItems: 'center', gap: Spacing.xs },
  actions: { gap: Spacing.sm, paddingBottom: Spacing.md },
  controlRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.md, paddingBottom: Spacing.sm },
  videoStage: {
    width: '100%',
    aspectRatio: 4 / 3,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: Radius.lg,
    backgroundColor: Colors.secondaryBackground,
  },
  remoteVideo: { width: '100%', height: '100%' },
  localVideo: {
    position: 'absolute',
    right: Spacing.md,
    top: Spacing.md,
    width: 104,
    height: 148,
    borderRadius: Radius.md,
  },
});
