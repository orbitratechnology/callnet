import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, Radius, Spacing } from '@/constants/theme';

export default function CallScreen() {
  const { person } = useLocalSearchParams<{ person?: string }>();
  const displayName = person ?? 'Someone you know';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Call', headerShown: false }} />
      <View style={styles.identity}>
        <ThemedText variant="title" style={styles.centered}>{displayName}</ThemedText>
        <ThemedText variant="body" tone="secondary" style={styles.centered} selectable>
          The call surface is ready for the local call engine in the next phase.
        </ThemedText>
      </View>
      <View style={styles.actions}>
        <Button title="Voice call" onPress={() => undefined} />
        <Button title="Video call" variant="secondary" onPress={() => undefined} />
        <Button title="Back" variant="ghost" onPress={() => router.back()} />
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
