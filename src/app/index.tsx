import { router, Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PersonRow } from '@/components/person-row';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';

const recentPeople = [
  { id: 'alex', name: 'Alex Morgan', initials: 'AM', detail: 'Last call · Yesterday' },
  { id: 'sarah', name: 'Sarah Chen', initials: 'SC', detail: 'Last call · Monday' },
  { id: 'david', name: 'David Okafor', initials: 'DO', detail: 'Last call · Sunday' },
];

export default function HomeScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Callnet', headerLargeTitle: true }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.container}>
          <View style={styles.intro}>
            <ThemedText variant="title">Private calls, made simple.</ThemedText>
            <ThemedText variant="body" tone="secondary" selectable>
              Find someone you know and connect in a single focused flow.
            </ThemedText>
          </View>

          <Button title="Start a call" size="lg" onPress={() => router.push('/select-person')} />

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText variant="headline">Recent</ThemedText>
              <IconButton label="Profile" onPress={() => router.push('/profile')} />
            </View>
            <View style={styles.list}>
              {recentPeople.map((person) => (
                <PersonRow
                  key={person.id}
                  name={person.name}
                  initials={person.initials}
                  detail={person.detail}
                  onPress={() => router.push('/select-person')}
                />
              ))}
            </View>
          </View>

          <View style={styles.privacyNote}>
            <ThemedText variant="caption" tone="brand">PRIVATE BY DESIGN</ThemedText>
            <ThemedText variant="subhead" tone="secondary" selectable>
              A calm, focused calling space with privacy details kept clear and factual.
            </ThemedText>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  container: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.xl },
  intro: { gap: Spacing.sm, paddingTop: Spacing.md },
  section: { gap: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { gap: Spacing.sm },
  privacyNote: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.secondaryBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
  },
});
