import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/ui/button';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-provider';
import { getUserProfile, type UserProfile } from '@/features/profile/profile-service';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    void getUserProfile(user.uid).then(setProfile).catch(() => setProfile(null));
  }, [user]);

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
            <Avatar
              initials={getInitials(profile?.displayName ?? user?.displayName ?? 'User')}
              photoURL={profile?.photoURL ?? user?.photoURL}
              size="lg"
            />
            <ThemedText variant="headline">{user?.displayName || 'Callnet account'}</ThemedText>
            {profile?.username ? <ThemedText variant="subhead" tone="secondary">@{profile.username}</ThemedText> : null}
            <ThemedText variant="subhead" tone="secondary" selectable>{user?.email ?? 'Email not available'}</ThemedText>
            <ThemedText variant="caption" tone="secondary">
              Share your @username so people can find you securely.
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

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'CN';
}
