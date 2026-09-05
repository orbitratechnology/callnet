import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/ui/button';
import { Colors, Radius, Spacing } from '@/constants/theme';
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
          <View style={styles.privacyCard}>
            <ThemedText variant="caption" tone="brand">PRIVACY</ThemedText>
            <ThemedText variant="headline">Clear, limited data handling</ThemedText>
            <PrivacyRow
              title="Media"
              description="Calls use WebRTC. Callnet does not record audio or video."
            />
            <PrivacyRow
              title="Connections"
              description="Direct connections are preferred. TURN may relay encrypted media when needed."
            />
            <PrivacyRow
              title="Call history"
              description="Detailed recent-call history is kept locally on this device."
            />
            <PrivacyRow
              title="Permissions"
              description="Microphone and camera access are requested only when a call needs them."
            />
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
  accountCard: { gap: Spacing.sm, padding: Spacing.md, backgroundColor: Colors.secondaryBackground, borderRadius: Radius.md },
  privacyCard: { gap: Spacing.md, padding: Spacing.md, backgroundColor: Colors.secondaryBackground, borderRadius: Radius.md },
  privacyRow: { gap: Spacing.xs },
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

function PrivacyRow({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.privacyRow}>
      <ThemedText variant="headline">{title}</ThemedText>
      <ThemedText variant="subhead" tone="secondary" selectable>{description}</ThemedText>
    </View>
  );
}
