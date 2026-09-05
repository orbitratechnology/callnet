import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, MaxContentWidth, Radius, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-provider';
import { getUserProfile, type UserProfile } from '@/features/profile/profile-service';
import { useAppTheme } from '@/features/theme/theme-provider';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { mode, toggleMode } = useAppTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!user) return;
    void getUserProfile(user.uid).then(setProfile).catch(() => setProfile(null));
  }, [user?.uid]);

  const displayName = profile?.displayName ?? user?.displayName ?? 'Callnet account';
  const photoURL = profile?.photoURL ?? user?.photoURL;

  return (
    <>
      <Stack.Screen options={{ title: 'Profile', headerLargeTitle: true }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <View style={styles.container}>
          <View style={styles.hero}>
            <Avatar initials={getInitials(displayName)} photoURL={photoURL} size="xl" />
            <View style={styles.heroCopy}>
              <ThemedText variant="title">{displayName}</ThemedText>
              {profile?.username ? (
                <ThemedText variant="body" tone="brand">@{profile.username}</ThemedText>
              ) : null}
              <ThemedText variant="subhead" tone="secondary" selectable>
                {user?.email ?? 'Email not available'}
              </ThemedText>
            </View>
          </View>

          <ThemedText variant="body" tone="secondary" selectable>
            Your account identifies you securely across devices.
          </ThemedText>
          <ThemedText variant="caption" tone="secondary">
            Share your @username so people can find you securely.
          </ThemedText>

          <View style={styles.section}>
            <ThemedText variant="caption" tone="brand">APPEARANCE</ThemedText>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Dark theme"
              accessibilityHint="Toggle dark theme"
              accessibilityState={{ checked: mode === 'dark' }}
              onPress={toggleMode}
              style={({ pressed }) => [styles.themeRow, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={styles.themeCopy}>
                <ThemedText variant="headline">Dark theme</ThemedText>
                <ThemedText variant="subhead" tone="secondary">
                  {mode === 'dark' ? 'On' : 'Off'}
                </ThemedText>
              </View>
              <Switch
                value={mode === 'dark'}
                accessible={false}
                pointerEvents="none"
                trackColor={{ false: '#D4D4D4', true: '#FFFFFF' }}
                thumbColor={mode === 'dark' ? '#000000' : '#FFFFFF'}
                ios_backgroundColor="#D4D4D4"
              />
            </Pressable>
          </View>

          <View style={styles.section}>
            <ThemedText variant="caption" tone="brand">PRIVACY</ThemedText>
            <ThemedText variant="headline">Clear, limited data handling</ThemedText>
            <View style={styles.privacyList}>
              <PrivacyRow title="Media" description="Calls use WebRTC. Callnet does not record audio or video." />
              <PrivacyRow title="Connections" description="Direct connections are preferred. TURN may relay encrypted media when needed." />
              <PrivacyRow title="Call history" description="Detailed recent-call history is kept locally on this device." />
              <PrivacyRow title="Permissions" description="Microphone and camera access are requested only when a call needs them." />
            </View>
          </View>

          <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: Spacing.lg },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.lg,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.secondaryBackground,
    boxShadow: Shadows.card,
  },
  heroCopy: { flex: 1, gap: Spacing.xs },
  section: {
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  themeRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.secondaryBackground,
    boxShadow: Shadows.card,
  },
  themeCopy: { flex: 1, gap: Spacing.xs },
  privacyList: {
    overflow: 'hidden',
    borderRadius: Radius.md,
    backgroundColor: Colors.secondaryBackground,
    boxShadow: Shadows.card,
  },
  privacyRow: {
    gap: Spacing.xs,
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  lastPrivacyRow: { borderBottomWidth: 0 },
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
  const isLast = title === 'Permissions';
  return (
    <View style={[styles.privacyRow, isLast ? styles.lastPrivacyRow : null]}>
      <ThemedText variant="headline">{title}</ThemedText>
      <ThemedText variant="subhead" tone="secondary" selectable>{description}</ThemedText>
    </View>
  );
}
