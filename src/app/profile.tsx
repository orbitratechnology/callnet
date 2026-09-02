import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-provider';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  return (
    <>
      <Stack.Screen options={{ title: 'Profile' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.container}>
          <ThemedText variant="title">Your profile</ThemedText>
          <ThemedText variant="body" tone="secondary" selectable>
            Your account is used to identify you securely for calls across devices.
          </ThemedText>
          <View style={styles.accountCard}>
            <ThemedText variant="headline">{user?.displayName || 'Callnet account'}</ThemedText>
            <ThemedText variant="subhead" tone="secondary" selectable>{user?.email ?? 'Email not available'}</ThemedText>
            <ThemedText variant="caption" tone="secondary" selectable>
              User ID: {user?.uid}
            </ThemedText>
            <ThemedText variant="caption" tone="secondary">
              Share this User ID only with people you trust so they can add you as a call contact.
            </ThemedText>
          </View>
          <View style={styles.divider} />
          <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: Spacing.lg },
  container: { gap: Spacing.lg },
  accountCard: { gap: Spacing.sm, padding: Spacing.md, backgroundColor: Colors.secondaryBackground, borderRadius: 16 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator },
});
