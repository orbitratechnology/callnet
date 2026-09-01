import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, Spacing } from '@/constants/theme';

export default function ProfileScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Profile' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.container}>
          <ThemedText variant="title">Your profile</ThemedText>
          <ThemedText variant="body" tone="secondary" selectable>
            Identity and privacy controls will live here. Sign-in is intentionally added only after the core call experience is complete.
          </ThemedText>
          <View style={styles.divider} />
          <Button title="Sign out" variant="ghost" disabled onPress={() => undefined} />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: Spacing.lg },
  container: { gap: Spacing.lg },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator },
});
