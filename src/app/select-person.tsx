import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';

import { PersonRow } from '@/components/person-row';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { type ContactInput } from '@/features/contacts/contacts-repository';
import { useCall } from '@/features/calls/call-provider';
import { Colors, Radius, Spacing } from '@/constants/theme';

function PersonListHeader({ count }: { count: number }) {
  return (
    <View style={styles.header}>
      <ThemedText variant="body" tone="secondary">
        {count > 0 ? 'Choose someone you know.' : 'Add someone using their Callnet User ID.'}
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

function AddContactForm({ onAdd }: { onAdd: (contact: ContactInput) => void }) {
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const normalizedName = name.trim();
    const normalizedUserId = userId.trim();
    if (!normalizedName || !normalizedUserId) {
      setError('Enter a name and User ID.');
      return;
    }
    if (normalizedUserId.length > 128) {
      setError('That User ID is too long.');
      return;
    }

    onAdd({
      name: normalizedName,
      handle: `@${normalizedUserId.slice(0, 8)}`,
      initials: getInitials(normalizedName),
      accent: '#54C2A4',
      identityId: normalizedUserId,
    });
    setName('');
    setUserId('');
    setError(null);
  };

  return (
    <View style={styles.addCard}>
      <ThemedText variant="headline">Add a contact</ThemedText>
      <ThemedText variant="subhead" tone="secondary">
        Ask the person to share the User ID shown in their Profile.
      </ThemedText>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Name"
        placeholderTextColor={Colors.secondaryLabel}
        style={styles.input}
        autoCapitalize="words"
      />
      <TextInput
        value={userId}
        onChangeText={setUserId}
        placeholder="Callnet User ID"
        placeholderTextColor={Colors.secondaryLabel}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {error ? <ThemedText variant="subhead" tone="destructive">{error}</ThemedText> : null}
      <Button title="Save contact" size="sm" onPress={submit} />
    </View>
  );
}

export default function SelectPersonScreen() {
  const { contacts, addContact } = useCall();

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
        ListFooterComponent={<AddContactForm onAdd={addContact} />}
        renderItem={({ item: person }) => (
          <PersonRow
            name={person.name}
            initials={person.initials}
            detail="Ready to call"
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
