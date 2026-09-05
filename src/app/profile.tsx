import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, MaxContentWidth, Radius, Shadows, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-provider';
import { getUserProfile, type UserProfile } from '@/features/profile/profile-service';
import { strings } from '@/localization/strings';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!user) return;
    void getUserProfile(user.uid).then(setProfile).catch(() => setProfile(null));
  }, [user?.uid]);

  const displayName = profile?.displayName ?? user?.displayName ?? strings.profile.accountFallback;
  const photoURL = profile?.photoURL ?? user?.photoURL;

  return (
    <>
      <Stack.Screen options={{ title: strings.profile.screenTitle, headerLargeTitle: true }} />
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
                {user?.email ?? strings.profile.emailUnavailable}
              </ThemedText>
            </View>
          </View>

          <ThemedText variant="body" tone="secondary" selectable>
            {strings.profile.identityCopy}
          </ThemedText>
          <ThemedText variant="caption" tone="secondary">
            {strings.profile.usernameHint}
          </ThemedText>

          <View style={styles.section}>
            <ThemedText variant="caption" tone="brand">{strings.profile.privacyLabel}</ThemedText>
            <ThemedText variant="headline">{strings.profile.privacyHeading}</ThemedText>
            <View style={styles.privacyList}>
              <PrivacyRow title={strings.profile.privacy.media} description={strings.profile.privacy.mediaCopy} />
              <PrivacyRow title={strings.profile.privacy.connections} description={strings.profile.privacy.connectionsCopy} />
              <PrivacyRow title={strings.profile.privacy.history} description={strings.profile.privacy.historyCopy} />
              <PrivacyRow title={strings.profile.privacy.permissions} description={strings.profile.privacy.permissionsCopy} />
            </View>
          </View>

          <Button title={strings.profile.signOut} variant="ghost" onPress={() => void signOut()} />
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
  const isLast = title === strings.profile.privacy.permissions;
  return (
    <View style={[styles.privacyRow, isLast ? styles.lastPrivacyRow : null]}>
      <ThemedText variant="headline">{title}</ThemedText>
      <ThemedText variant="subhead" tone="secondary" selectable>{description}</ThemedText>
    </View>
  );
}
