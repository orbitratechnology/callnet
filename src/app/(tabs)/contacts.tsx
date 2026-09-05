import { router } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PersonRow } from '@/components/person-row';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, MaxContentWidth, Radius, Spacing, useBrandColors, useThemeBackground } from '@/constants/theme';
import { useCall } from '@/features/calls/call-provider';
import type { DemoPerson } from '@/features/contacts/demo-people';

type ContactFilter = 'all' | 'recent';

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const brand = useBrandColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        selected
          ? { backgroundColor: brand.accent, borderColor: brand.accent }
          : { backgroundColor: Colors.secondaryBackground, borderColor: Colors.separator },
        { opacity: pressed ? 0.74 : 1 },
      ]}
    >
      <ThemedText variant="caption" style={{ color: selected ? brand.onAccent : Colors.secondaryLabel }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function ContactsHeader({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  count,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  filter: ContactFilter;
  onFilterChange: (value: ContactFilter) => void;
  count: number;
}) {
  return (
    <View style={styles.header}>
      <TextInput
        accessibilityLabel="Search contacts"
        placeholder="Search name or @username"
        placeholderTextColor={Colors.secondaryLabel as string}
        value={query}
        onChangeText={onQueryChange}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={styles.searchInput}
      />
      <View style={styles.filters} accessibilityRole="tablist">
        <FilterChip
          label="All"
          selected={filter === 'all'}
          onPress={() => onFilterChange('all')}
        />
        <FilterChip
          label="Recent"
          selected={filter === 'recent'}
          onPress={() => onFilterChange('recent')}
        />
      </View>
    </View>
  );
}

function ContactsEmptyState({ hasQuery, isRecent }: { hasQuery: boolean; isRecent: boolean }) {
  return (
    <View style={styles.emptyState}>
      <ThemedText variant="headline">
        {hasQuery || isRecent ? 'No contacts match your search.' : 'Add someone using their Callnet username.'}
      </ThemedText>
      <ThemedText variant="subhead" tone="secondary">
        {hasQuery || isRecent ? 'Add someone using their Callnet username.' : 'No contacts match your search.'}
      </ThemedText>
    </View>
  );
}

export default function ContactsScreen() {
  const { contacts, recentCalls } = useCall();
  const backgroundColor = useThemeBackground();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ContactFilter>('all');
  const deferredQuery = useDeferredValue(query);
  const recentContactIds = useMemo(
    () => new Set(recentCalls.map((call) => call.person.id)),
    [recentCalls],
  );
  const visibleContacts = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return contacts.filter((person) => {
      if (filter === 'recent' && !recentContactIds.has(person.id)) return false;
      if (!normalizedQuery) return true;

      return [person.name, person.handle, person.identityId]
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [contacts, deferredQuery, filter, recentContactIds]);

  const renderContact = ({ item }: { item: DemoPerson }) => (
    <PersonRow
      name={item.name}
      initials={item.initials}
      photoURL={item.photoURL}
      detail={item.handle}
      onPress={() => router.push({ pathname: '/contact/[personId]', params: { personId: item.id } })}
      style={styles.contactRow}
    />
  );

  return (
    <View style={[styles.screen, { backgroundColor }]}>
      <FlatList
        data={visibleContacts}
        keyExtractor={(person) => person.id}
        renderItem={renderContact}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <ContactsHeader
            query={query}
            onQueryChange={setQuery}
            filter={filter}
            onFilterChange={setFilter}
            count={visibleContacts.length}
          />
        }
        ListEmptyComponent={
          <ContactsEmptyState hasQuery={Boolean(query.trim())} isRecent={filter === 'recent'} />
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Button title="Add contact" variant="secondary" size="md" onPress={() => router.push('/select-person')} />
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.systemBackground },
  listContent: { flexGrow: 1, paddingBottom: Spacing.xl },
  header: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  headingRow: { flexDirection: 'row', alignItems: 'center' },
  headingCopy: { gap: Spacing.xs },
  searchInput: {
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
    backgroundColor: Colors.secondaryBackground,
    color: Colors.label as string,
    fontSize: 16,
  },
  filters: { flexDirection: 'row', gap: Spacing.sm },
  filterChip: {
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  contactRow: {
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.systemBackground,
  },
  emptyState: { gap: Spacing.xs, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xl },
  footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
});
