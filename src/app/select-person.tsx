import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';

import { PersonRow } from '@/components/person-row';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { useCall } from '@/features/calls/call-provider';
import type { DemoPerson } from '@/features/contacts/demo-people';
import { findUserProfileByUsername, type UserProfile } from '@/features/profile/profile-service';
import { useAuth } from '@/features/auth/auth-provider';
import { Colors, Radius, Spacing } from '@/constants/theme';

function PersonListHeader({ count }: { count: number }) {
  return (
    <View style={styles.header}>
      <ThemedText variant="body" tone="secondary">
        {count > 0 ? 'Choose someone you know.' : 'Find someone using their Callnet username.'}
      </ThemedText>
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

  return (
    <>
      <Stack.Screen options={{ title: 'Start a call' }} />
      <FlatList
        data={contacts}
        keyExtractor={(person) => person.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={PersonSeparator}
        ListHeaderComponent={<PersonListHeader count={contacts.length} />}
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
