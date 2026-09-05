import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';

import { PersonRow } from '@/components/person-row';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { useCall } from '@/features/calls/call-provider';
import type { DemoPerson } from '@/features/contacts/demo-people';
import { findUserProfileByUsername, type UserProfile } from '@/features/profile/profile-service';
import { useAuth } from '@/features/auth/auth-provider';
import { Colors, Radius, Spacing } from '@/constants/theme';

function matchesPerson(person: DemoPerson, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return [person.name, person.handle, person.identityId].some((value) =>
    value.toLowerCase().includes(normalizedQuery),
  );
}

function PersonListHeader({
  count,
  query,
  resultCount,
  onQueryChange,
}: {
  count: number;
  query: string;
  resultCount: number;
  onQueryChange: (value: string) => void;
}) {
  const hasQuery = query.trim().length > 0;
  const helperText =
    count === 0
      ? 'Find someone using their Callnet username.'
      : hasQuery
        ? resultCount > 0
          ? `${resultCount} ${resultCount === 1 ? 'contact' : 'contacts'} match your search.`
          : 'No matching contacts.'
        : 'Choose someone you know.';

  return (
    <View style={styles.header}>
      <View style={styles.searchCard}>
        <ThemedText variant="caption" tone="secondary">Contacts</ThemedText>
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search name or @username"
          placeholderTextColor={Colors.secondaryLabel}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
          accessibilityLabel="Search contacts"
          accessibilityRole="search"
        />
      </View>
      <ThemedText variant="body" tone="secondary">{helperText}</ThemedText>
    </View>
  );
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'CN';
}

function AddContactForm({ onAdd, ownerUid }: { onAdd: (contact: Omit<DemoPerson, 'id'>) => void; ownerUid: string }) {
  const [username, setUsername] = useState('');
  const [result, setResult] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const submit = async () => {
    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
      setError('Enter a username.');
      return;
    }
    setError(null);
    setResult(null);
    setIsSearching(true);
    try {
      const profile = await findUserProfileByUsername(normalizedUsername);
      if (!profile) {
        setError('No Callnet user was found with that username.');
        return;
      }
      if (profile.uid === ownerUid) {
        setError('You cannot add yourself as a call contact.');
        return;
      }
      setResult(profile);
    } catch {
      setError('Could not search Callnet right now. Try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const addResult = () => {
    if (!result) {
      return;
    }
    onAdd({
      name: result.displayName,
      handle: `@${result.username}`,
      initials: getInitials(result.displayName),
      photoURL: result.photoURL,
      accent: '#54C2A4',
      identityId: result.uid,
    });
    setUsername('');
    setResult(null);
  };

  return (
    <View style={styles.addCard}>
      <ThemedText variant="headline">Find a Callnet user</ThemedText>
      <ThemedText variant="subhead" tone="secondary">
        Ask the person to share their username. Only exact matches are returned.
      </ThemedText>
      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="Username"
        placeholderTextColor={Colors.secondaryLabel}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {error ? <ThemedText variant="subhead" tone="destructive">{error}</ThemedText> : null}
      {result ? (
        <View style={styles.result}>
          <PersonRow
            name={result.displayName}
            initials={getInitials(result.displayName)}
            photoURL={result.photoURL}
            detail={`@${result.username}`}
            onPress={addResult}
          />
          <Button title="Add to contacts" size="sm" onPress={addResult} />
        </View>
      ) : null}
      <Button title="Find user" size="sm" loading={isSearching} onPress={() => void submit()} />
    </View>
  );
}

export default function SelectPersonScreen() {
  const { contacts, addContact } = useCall();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const visibleContacts = useMemo(
    () => contacts.filter((person) => matchesPerson(person, query)),
    [contacts, query],
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Start a call' }} />
      <FlatList
        data={visibleContacts}
        keyExtractor={(person) => person.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={PersonSeparator}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <PersonListHeader
            count={contacts.length}
            query={query}
            resultCount={visibleContacts.length}
            onQueryChange={setQuery}
          />
        }
        ListFooterComponent={<AddContactForm onAdd={addContact} ownerUid={user?.uid ?? ''} />}
        renderItem={({ item: person }) => (
          <PersonRow
            name={person.name}
            initials={person.initials}
            photoURL={person.photoURL}
            detail={person.handle}
            onPress={() => router.push({ pathname: '/call', params: { personId: person.id } })}
          />
        )}
      />
    </>
  );
}

function PersonSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg },
  header: { paddingBottom: Spacing.lg },
  searchCard: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.secondaryBackground,
  },
  separator: { height: Spacing.sm },
  addCard: {
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.secondaryBackground,
  },
  result: { gap: Spacing.sm },
  input: {
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
    borderRadius: Radius.md,
    color: Colors.label,
    backgroundColor: Colors.systemBackground,
    fontSize: 16,
  },
});
