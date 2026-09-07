import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PersonRow } from '@/components/person-row';
import { ThemedText } from '@/components/themed-text';
import { SearchBar } from '@/components/ui/search-bar';
import { Colors, MaxContentWidth, Radius, Shadows, Spacing, useBrandColors, useThemeBackground } from '@/constants/theme';
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
}: {
  query: string;
  onQueryChange: (value: string) => void;
  filter: ContactFilter;
  onFilterChange: (value: ContactFilter) => void;
}) {
  return (
    <View style={styles.header}>
      <SearchBar
        value={query}
        onChangeText={onQueryChange}
        onClear={() => onQueryChange('')}
        placeholder="Search contacts"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Search saved contacts by name, phone, or email"
        accessibilityRole="search"
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
        {hasQuery ? 'No saved contacts match that search.' : isRecent ? 'No recent contacts yet.' : 'No contacts to add yet.'}
      </ThemedText>
      <ThemedText variant="subhead" tone="secondary">
        {hasQuery ? 'Try a different name, phone number, or email.' : isRecent ? 'People you call will appear here.' : 'People from your phone will appear here when they join Callnet.'}
      </ThemedText>
    </View>
  );
}

export default function ContactsScreen() {
  const { contacts, recentCalls } = useCall();
  const backgroundColor = useThemeBackground();
  const brand = useBrandColors();
  const insets = useSafeAreaInsets();
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

      return [person.name, person.email ?? '', person.phoneNumber ?? '']
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
          />
        }
        ListEmptyComponent={
          <ContactsEmptyState hasQuery={Boolean(query.trim())} isRecent={filter === 'recent'} />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 104 }]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add contact"
        accessibilityHint="Import people from your device contacts"
        onPress={() => router.push('/select-person')}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: brand.accent, bottom: insets.bottom + 88, opacity: pressed ? 0.78 : 1 },
        ]}
      >
        <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={28} tintColor={brand.onAccent} />
      </Pressable>
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
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    boxShadow: Shadows.floating,
  },
});
