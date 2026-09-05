import { Share, StyleSheet, TextInput, View } from 'react-native';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { DemoPerson } from '@/features/contacts/demo-people';
import { getInitials } from '@/features/contacts/demo-people';
import type { CallKind } from '@/features/calls/call-state';
import {
  normalizeDirectorySearchValue,
  searchUserProfiles,
  type UserProfile,
} from '@/features/profile/profile-service';

type SearchKind = 'name' | 'username' | 'phone' | 'email';

function getSearchKind(value: string): SearchKind {
  const query = value.trim();
  if (query.includes('@') && !query.startsWith('@')) return 'email';
  if (query.startsWith('+') || /^[\d\s().-]+$/.test(query)) return 'phone';
  if (query.startsWith('@')) return 'username';
  return 'name';
}

function canInvite(value: string, kind: SearchKind) {
  const query = value.trim();
  if (kind === 'email') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query);
  }
  if (kind === 'phone') {
    return normalizeDirectorySearchValue(query).replace(/^\+/, '').length >= 7;
  }
  return false;
}

function matchesPerson(person: DemoPerson, query: string) {
  const normalizedQuery = normalizeDirectorySearchValue(query);
  if (!normalizedQuery) return true;

  return [person.name, person.handle, person.email ?? '', person.phoneNumber ?? '', person.identityId]
    .some((value) => normalizeDirectorySearchValue(value).includes(normalizedQuery));
}

function personFromProfile(profile: UserProfile): DemoPerson {
  return {
    id: `contact-${profile.uid}`,
    name: profile.displayName,
    handle: `@${profile.username}`,
    initials: getInitials(profile.displayName),
    photoURL: profile.photoURL,
    accent: '#000000',
    identityId: profile.uid,
  };
}

function SearchPersonRow({
  person,
  onStartCall,
}: {
  person: DemoPerson;
  onStartCall: (person: DemoPerson, kind: CallKind) => void;
}) {
  return (
    <View style={styles.resultRow}>
      <View style={styles.personCopy}>
        <Avatar initials={person.initials} photoURL={person.photoURL} size="md" accessible={false} />
        <View style={styles.personText}>
          <ThemedText variant="headline" numberOfLines={1}>{person.name}</ThemedText>
          <ThemedText variant="subhead" tone="secondary" numberOfLines={1}>{person.handle}</ThemedText>
          <ThemedText variant="caption" tone="brand">On Callnet</ThemedText>
        </View>
      </View>
      <View style={styles.resultActions}>
        <Button
          title="Audio"
          variant="secondary"
          size="sm"
          accessibilityLabel={`Audio call ${person.name}`}
          onPress={() => onStartCall(person, 'voice')}
          style={styles.actionButton}
        />
        <Button
          title="Video"
          size="sm"
          accessibilityLabel={`Video call ${person.name}`}
          onPress={() => onStartCall(person, 'video')}
          style={styles.actionButton}
        />
      </View>
    </View>
  );
}

export function PeopleSearch({
  contacts,
  getIdToken,
  onStartCall,
}: {
  contacts: DemoPerson[];
  getIdToken: () => Promise<string>;
  onStartCall: (person: DemoPerson, kind: CallKind) => void;
}) {
  const [query, setQuery] = useState('');
  const [remoteProfiles, setRemoteProfiles] = useState<UserProfile[]>([]);
  const [remoteState, setRemoteState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const deferredQuery = useDeferredValue(query);
  const searchKind = getSearchKind(query);

  const localResults = useMemo(
    () => contacts.filter((person) => matchesPerson(person, query)),
    [contacts, query],
  );
  const results = useMemo(() => {
    const byIdentity = new Map(localResults.map((person) => [person.identityId, person]));
    remoteProfiles.forEach((profile) => {
      const person = personFromProfile(profile);
      const existing = byIdentity.get(person.identityId);
      byIdentity.set(person.identityId, existing ? { ...existing, ...person } : person);
    });
    return [...byIdentity.values()];
  }, [localResults, remoteProfiles]);

  useEffect(() => {
    const normalizedQuery = deferredQuery.trim();
    if (normalizedQuery.length < 2) {
      setRemoteProfiles([]);
      setRemoteState('idle');
      return;
    }

    let active = true;
    setRemoteProfiles([]);
    setRemoteState('loading');
    const timer = setTimeout(() => {
      void getIdToken()
        .then((token) => searchUserProfiles(normalizedQuery, token))
        .then((profiles) => {
          if (!active) return;
          setRemoteProfiles(profiles);
          setRemoteState('done');
        })
        .catch(() => {
          if (!active) return;
          setRemoteProfiles([]);
          setRemoteState('error');
        });
    }, 220);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [deferredQuery, getIdToken]);

  const invite = () => {
    void Share.share({ message: `Join me on Callnet: ${query.trim()}` }).catch(() => undefined);
  };

  const showSearchState = query.trim().length > 0;
  const showInvite = showSearchState && remoteState === 'done' && results.length === 0 && canInvite(query, searchKind);

  return (
    <View style={styles.container}>
      <View style={styles.inputShell}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Name, @username, phone, or email"
          placeholderTextColor={Colors.secondaryLabel as string}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
          accessibilityLabel="Search people"
          accessibilityRole="search"
        />
      </View>

      {showSearchState ? (
        <View style={styles.resultsCard}>
          {results.map((person) => (
            <SearchPersonRow key={person.identityId} person={person} onStartCall={onStartCall} />
          ))}
          {remoteState === 'loading' ? (
            <ThemedText variant="subhead" tone="secondary">Searching Callnet…</ThemedText>
          ) : null}
          {remoteState === 'error' ? (
            <ThemedText variant="subhead" tone="secondary">Search is unavailable right now.</ThemedText>
          ) : null}
          {showInvite ? (
            <View style={styles.inviteRow}>
              <View style={styles.inviteCopy}>
                <ThemedText variant="headline">This person isn’t on Callnet.</ThemedText>
                <ThemedText variant="subhead" tone="secondary">{query.trim()}</ThemedText>
              </View>
              <Button title="Invite" variant="secondary" size="sm" onPress={invite} />
            </View>
          ) : null}
          {remoteState === 'done' && results.length === 0 && !showInvite ? (
            <ThemedText variant="subhead" tone="secondary">No people found.</ThemedText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  inputShell: {
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
    backgroundColor: Colors.secondaryBackground,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    color: Colors.label as string,
    fontSize: 16,
  },
  resultsCard: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.secondaryBackground,
  },
  resultRow: { gap: Spacing.md },
  personCopy: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  personText: { flex: 1, gap: Spacing.xs },
  resultActions: { flexDirection: 'row', gap: Spacing.sm },
  actionButton: { flex: 1 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  inviteCopy: { flex: 1, gap: Spacing.xs },
});
