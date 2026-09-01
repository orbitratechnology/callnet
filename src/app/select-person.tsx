import { router, Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PersonRow } from '@/components/person-row';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

const people = [
  { id: 'alex', name: 'Alex Morgan', initials: 'AM', detail: 'Available' },
  { id: 'sarah', name: 'Sarah Chen', initials: 'SC', detail: 'Available' },
  { id: 'david', name: 'David Okafor', initials: 'DO', detail: 'Available' },
];

export default function SelectPersonScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Start a call' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.container}>
          <ThemedText variant="body" tone="secondary">
            Choose someone you know.
          </ThemedText>
          <View style={styles.list}>
            {people.map((person) => (
              <PersonRow
                key={person.id}
                name={person.name}
                initials={person.initials}
                detail={person.detail}
                onPress={() => router.push({ pathname: '/call', params: { person: person.name } })}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg },
  container: { gap: Spacing.lg },
  list: { gap: Spacing.sm },
});
