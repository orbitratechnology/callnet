import { router, Stack } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { PersonRow } from '@/components/person-row';
import { ThemedText } from '@/components/themed-text';
import { demoPeople, type DemoPerson } from '@/features/contacts/demo-people';
import { Spacing } from '@/constants/theme';

function PersonListHeader() {
  return (
    <ThemedText variant="body" tone="secondary" style={styles.header}>
      Choose someone you know.
    </ThemedText>
  );
}

export default function SelectPersonScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Start a call' }} />
      <FlatList<DemoPerson>
        data={demoPeople}
        keyExtractor={(person) => person.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={PersonSeparator}
        ListHeaderComponent={PersonListHeader}
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
});
