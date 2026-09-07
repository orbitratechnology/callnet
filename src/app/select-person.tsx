import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, MaxContentWidth, Radius, Shadows, Spacing, useBrandColors, useThemeBackground } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-provider';
import { useCall } from '@/features/calls/call-provider';
import {
  getDeviceContactsPermission,
  readDeviceContacts,
  requestDeviceContactsPermission,
  type DeviceContact,
  type DeviceContactsPermission,
} from '@/features/contacts/device-contacts';
import { getInitials } from '@/features/contacts/demo-people';
import { matchDeviceContacts, type UserProfile } from '@/features/profile/profile-service';

type MatchedContact = {
  device: DeviceContact;
  profile: UserProfile;
};

function MatchedContactRow({
  match,
  isAdded,
  onAdd,
}: {
  match: MatchedContact;
  isAdded: boolean;
  onAdd: () => void;
}) {
  const brand = useBrandColors();
  const detail = match.device.phoneNumber || match.device.email || `@${match.profile.username}`;

  return (
    <View style={styles.contactRow}>
      <Avatar
        initials={getInitials(match.profile.displayName)}
        photoURL={match.profile.photoURL}
        size="md"
        accessibilityLabel={`${match.profile.displayName} profile picture`}
      />
      <View style={styles.contactCopy}>
        <ThemedText variant="headline" numberOfLines={1}>{match.profile.displayName}</ThemedText>
        <ThemedText variant="subhead" tone="secondary" numberOfLines={1}>{detail}</ThemedText>
        {match.device.name !== match.profile.displayName ? (
          <ThemedText variant="caption" tone="secondary" numberOfLines={1}>Saved as {match.device.name}</ThemedText>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isAdded ? `${match.profile.displayName} added` : `Add ${match.profile.displayName}`}
        accessibilityState={{ disabled: isAdded }}
        disabled={isAdded}
        onPress={onAdd}
        style={({ pressed }) => [
          styles.addButton,
          { backgroundColor: isAdded ? Colors.secondaryBackground : brand.accent, opacity: pressed ? 0.72 : 1 },
        ]}
      >
        <ThemedText variant="caption" style={{ color: isAdded ? Colors.secondaryLabel : brand.onAccent }}>
          {isAdded ? 'Added' : 'Add'}
        </ThemedText>
      </Pressable>
    </View>
  );
}

function IntroHeader({
  matches,
  unaddedCount,
  onAddAll,
}: {
  matches: MatchedContact[];
  unaddedCount: number;
  onAddAll: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.heroCopy}>
        <ThemedText variant="title">Bring your contacts to Callnet</ThemedText>
        <ThemedText variant="body" tone="secondary">
          We’ll show only people from your address book who already use Callnet.
        </ThemedText>
      </View>
      {matches.length > 0 ? (
        <View style={styles.matchSummary}>
          <View style={styles.summaryCopy}>
            <ThemedText variant="headline">{matches.length} {matches.length === 1 ? 'person' : 'people'} on Callnet</ThemedText>
            <ThemedText variant="caption" tone="secondary">Your contact list is not uploaded.</ThemedText>
          </View>
          {unaddedCount > 0 ? <Button title="Add all" size="sm" onPress={onAddAll} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function PermissionState({
  permission,
  onRequest,
}: {
  permission: DeviceContactsPermission;
  onRequest: () => void;
}) {
  const backgroundColor = useThemeBackground();
  const canOpenSettings = !permission.canAskAgain;

  return (
    <View style={[styles.state, { backgroundColor }]}>
      <ThemedText variant="title" style={styles.centerText}>Find people you already know</ThemedText>
      <ThemedText variant="body" tone="secondary" style={styles.centerText}>
        Allow access so Callnet can check your phone contacts for people you know. Your contact list is not uploaded.
      </ThemedText>
      <Button
        title={canOpenSettings ? 'Open Settings' : 'Allow contacts'}
        onPress={canOpenSettings ? () => void Linking.openSettings() : onRequest}
      />
    </View>
  );
}

function EmptyState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <View style={styles.emptyState}>
      <ThemedText variant="headline">{error ? 'We couldn’t check your contacts.' : 'No one from your contacts is on Callnet yet.'}</ThemedText>
      <ThemedText variant="subhead" tone="secondary">
        {error ? 'Check your connection and try again.' : 'When a contact joins Callnet, they’ll appear here.'}
      </ThemedText>
      {error ? <Button title="Try again" variant="secondary" size="sm" onPress={onRetry} /> : null}
    </View>
  );
}

export default function SelectPersonScreen() {
  const { user, getIdToken } = useAuth();
  const { contacts, addContact } = useCall();
  const backgroundColor = useThemeBackground();
  const [permission, setPermission] = useState<DeviceContactsPermission | null>(null);
  const [matches, setMatches] = useState<MatchedContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMatches = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const deviceContacts = await readDeviceContacts();
      const token = await getIdToken();
      const profileMatches = await matchDeviceContacts(deviceContacts, token);
      const deviceById = new Map(deviceContacts.map((contact) => [contact.contactId, contact]));
      const nextMatches = profileMatches.flatMap((match) => {
        const device = deviceById.get(match.contactId);
        if (!device || match.profile.uid === user?.uid) {
          return [];
        }
        return [{ device, profile: match.profile }];
      });
      setMatches(nextMatches);
    } catch {
      setMatches([]);
      setError('load-failed');
    } finally {
      setIsLoading(false);
    }
  }, [getIdToken, user?.uid]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void getDeviceContactsPermission().then((nextPermission) => {
      if (!active) return;
      setPermission(nextPermission);
      if (nextPermission.granted) {
        void loadMatches();
      }
    }).catch(() => {
      if (active) setPermission({ granted: false, canAskAgain: true });
    });

    return () => {
      active = false;
    };
  }, [loadMatches]));

  const requestAccess = useCallback(async () => {
    const nextPermission = await requestDeviceContactsPermission();
    setPermission(nextPermission);
    if (nextPermission.granted) {
      void loadMatches();
    }
  }, [loadMatches]);

  const addOne = useCallback((match: MatchedContact) => {
    addContact({
      name: match.profile.displayName,
      handle: `@${match.profile.username}`,
      initials: getInitials(match.profile.displayName),
      photoURL: match.profile.photoURL,
      email: match.device.email,
      phoneNumber: match.device.phoneNumber,
      accent: '#000000',
      identityId: match.profile.uid,
    });
  }, [addContact]);

  const addedIds = useMemo(() => new Set(contacts.map((contact) => contact.identityId)), [contacts]);
  const unaddedCount = matches.filter((match) => !addedIds.has(match.profile.uid)).length;

  const addAll = useCallback(() => {
    matches.forEach((match) => {
      if (!addedIds.has(match.profile.uid)) {
        addOne(match);
      }
    });
  }, [addOne, addedIds, matches]);

  if (permission === null) {
    return (
      <View style={[styles.state, { backgroundColor }]}>
        <Stack.Screen options={{ title: 'Add contacts' }} />
        <ActivityIndicator color={Colors.label} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <>
        <Stack.Screen options={{ title: 'Add contacts' }} />
        <PermissionState permission={permission} onRequest={() => void requestAccess()} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Add contacts' }} />
      <FlatList
        data={matches}
        keyExtractor={(match) => `${match.device.contactId}-${match.profile.uid}`}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.listContent, { backgroundColor }]}
        ListHeaderComponent={
          <IntroHeader matches={matches} unaddedCount={unaddedCount} onAddAll={addAll} />
        }
        ListEmptyComponent={isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.label} />
            <ThemedText variant="subhead" tone="secondary">Looking for people you know…</ThemedText>
          </View>
        ) : <EmptyState error={error} onRetry={() => void loadMatches()} />}
        renderItem={({ item }) => (
          <MatchedContactRow
            match={item}
            isAdded={addedIds.has(item.profile.uid)}
            onAdd={() => addOne(item)}
          />
        )}
        ItemSeparatorComponent={ContactSeparator}
      />
    </>
  );
}

function ContactSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  listContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: { gap: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.lg },
  heroCopy: { gap: Spacing.xs },
  matchSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.secondaryBackground,
    boxShadow: Shadows.card,
  },
  summaryCopy: { flex: 1, gap: Spacing.xs },
  contactRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  contactCopy: { flex: 1, gap: Spacing.xs },
  addButton: {
    minWidth: 68,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
  },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator },
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  centerText: { maxWidth: 420, textAlign: 'center' },
  loadingState: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl },
  emptyState: { gap: Spacing.sm, paddingVertical: Spacing.xxl },
});
