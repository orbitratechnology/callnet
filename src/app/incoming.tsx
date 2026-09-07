import { router, Stack } from 'expo-router';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { CallColors, Radius, Spacing } from '@/constants/theme';
import { useCall } from '@/features/calls/call-provider';

function IncomingAction({
  label,
  ios,
  android,
  destructive = false,
  disabled = false,
  onPress,
}: {
  label: string;
  ios: SFSymbol;
  android: AndroidSymbol;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.actionItem}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.actionButton,
          destructive ? styles.declineButton : styles.answerButton,
          { opacity: disabled ? 0.45 : pressed ? 0.72 : 1 },
        ]}
      >
        <SymbolView name={{ ios, android, web: android }} size={26} tintColor={CallColors.onSurface} />
      </Pressable>
      <ThemedText variant="caption" style={styles.actionLabel}>{label}</ThemedText>
    </View>
  );
}

export default function IncomingCallScreen() {
  const { session, acceptIncoming, reject } = useCall();
  const insets = useSafeAreaInsets();
  const isIncoming = session?.direction === 'incoming' && session.state === 'ringing';
  const [isAnswering, setIsAnswering] = useState(false);

  useEffect(() => {
    if (!isIncoming) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      reject();
      router.back();
      return true;
    });

    return () => subscription.remove();
  }, [isIncoming, reject]);

  if (!isIncoming || !session) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Incoming Call', headerShown: false }} />
        <View style={styles.emptyCopy}>
          <ThemedText variant="title" style={[styles.centered, styles.callOnSurfaceText]}>No incoming call</ThemedText>
          <ThemedText variant="body" style={[styles.centered, styles.secondaryText]}>This call is no longer available.</ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, { bottom: insets.bottom + Spacing.lg, opacity: pressed ? 0.72 : 1 }]}
        >
          <ThemedText variant="headline" style={styles.callOnSurfaceText}>Back</ThemedText>
        </Pressable>
      </View>
    );
  }

  const callType = session.kind === 'video' ? 'Video' : 'Voice';

  const answer = async () => {
    if (isAnswering) return;

    setIsAnswering(true);
    try {
      await acceptIncoming();
      router.replace({ pathname: '/call', params: { personId: session.person.id } });
    } finally {
      setIsAnswering(false);
    }
  };

  const decline = () => {
    reject();
    router.back();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Incoming Call', headerShown: false }} />
      <View style={[styles.topBar, { top: insets.top + Spacing.sm }]}>
        <ThemedText variant="caption" style={styles.secondaryText}>{`INCOMING ${callType.toUpperCase()} CALL`}</ThemedText>
      </View>

      <View style={styles.identity}>
        <View style={styles.avatarHalo}>
          <Avatar initials={session.person.initials} photoURL={session.person.photoURL} size="xl" />
        </View>
        <ThemedText variant="largeTitle" style={[styles.centered, styles.callOnSurfaceText]}>{session.person.name}</ThemedText>
        <ThemedText variant="body" style={[styles.centered, styles.secondaryText]}>{session.person.phoneNumber || 'Callnet contact'}</ThemedText>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <ThemedText variant="subhead" style={styles.callOnSurfaceText}>Calling you now</ThemedText>
        </View>
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <IncomingAction label="Decline" ios="phone.down.fill" android="call_end" destructive disabled={isAnswering} onPress={decline} />
        <IncomingAction label={`Answer ${callType.toLowerCase()}`} ios="phone.fill" android="call" disabled={isAnswering} onPress={() => void answer()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CallColors.background },
  topBar: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  identity: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl },
  avatarHalo: { padding: Spacing.sm, borderRadius: Radius.full, backgroundColor: CallColors.surfaceStrong },
  centered: { textAlign: 'center' },
  callOnSurfaceText: { color: CallColors.onSurface },
  secondaryText: { color: CallColors.onSurfaceSecondary },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, backgroundColor: CallColors.surface },
  statusDot: { width: 8, height: 8, borderRadius: Radius.full, backgroundColor: '#46A982' },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xxl },
  actionItem: { alignItems: 'center', gap: Spacing.sm, minWidth: 88 },
  actionButton: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.full },
  answerButton: { backgroundColor: '#46A982' },
  declineButton: { backgroundColor: CallColors.endCall },
  actionLabel: { color: CallColors.onSurface, textAlign: 'center' },
  emptyCopy: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  backButton: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.full, backgroundColor: CallColors.surface },
});
