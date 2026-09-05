import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { useCall } from '@/features/calls/call-provider';
import { Colors, Radius, Spacing, useThemeBackground } from '@/constants/theme';

export default function IncomingCallScreen() {
  const { session, acceptIncoming, reject } = useCall();
  const backgroundColor = useThemeBackground();
  const isIncoming = session?.direction === 'incoming' && session.state === 'ringing';
  const [isAnswering, setIsAnswering] = useState(false);

  useEffect(() => {
    if (!isIncoming) {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      reject();
      router.back();
      return true;
    });

    return () => subscription.remove();
  }, [isIncoming, reject]);

  if (!isIncoming || !session) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <Stack.Screen options={{ title: 'Incoming Call', headerShown: false }} />
        <View style={styles.identity}>
          <ThemedText variant="title" style={styles.centered}>No incoming call</ThemedText>
          <ThemedText variant="body" tone="secondary" style={styles.centered}>
            This call is no longer available.
          </ThemedText>
        </View>
        <Button title="Back" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  const callType = session.kind === 'video' ? 'Video' : 'Voice';

  const answer = async () => {
    if (isAnswering) {
      return;
    }

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
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen options={{ title: 'Incoming Call', headerShown: false }} />
      <View style={styles.topBar}>
        <ThemedText variant="caption" tone="secondary">{`INCOMING ${callType.toUpperCase()} CALL`}</ThemedText>
      </View>

      <View style={styles.identity}>
        <Avatar initials={session.person.initials} photoURL={session.person.photoURL} size="lg" />
        <ThemedText variant="title" style={styles.centered}>{session.person.name}</ThemedText>
        <ThemedText variant="body" tone="secondary" style={styles.centered}>
          {session.person.handle}
        </ThemedText>
        <ThemedText variant="headline" tone="brand" style={styles.centered}>
          Calling you now
        </ThemedText>
      </View>

      <View style={styles.actions}>
        <Button title={`Answer ${callType.toLowerCase()} call`} loading={isAnswering} onPress={() => void answer()} />
        <Button title="Decline" variant="destructive" disabled={isAnswering} onPress={decline} />
      </View>
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
  topBar: { alignItems: 'center' },
  identity: {
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    backgroundColor: Colors.secondaryBackground,
  },
  centered: { textAlign: 'center' },
  actions: { gap: Spacing.sm, paddingBottom: Spacing.md },
});
