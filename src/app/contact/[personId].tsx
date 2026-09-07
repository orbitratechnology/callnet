import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, MaxContentWidth, Radius, Spacing, useBrandColors, useThemeBackground } from '@/constants/theme';
import { useCall } from '@/features/calls/call-provider';

type ContactActionProps = {
  label: string;
  ios: SFSymbol;
  android: AndroidSymbol;
  onPress: () => void;
};

function ContactAction({ label, ios, android, onPress }: ContactActionProps) {
  const brand = useBrandColors();

  return (
    <View style={styles.actionItem}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [
          styles.actionButton,
          { backgroundColor: brand.accentSoft, opacity: pressed ? 0.72 : 1 },
        ]}
      >
        <SymbolView name={{ ios, android, web: android }} size={23} tintColor={brand.accentContrast} />
      </Pressable>
      <ThemedText variant="caption" style={styles.actionLabel}>{label}</ThemedText>
    </View>
  );
}

function ContactInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText variant="subhead" tone="secondary">{label}</ThemedText>
      <ThemedText variant="headline">{value}</ThemedText>
    </View>
  );
}

export default function ContactProfileScreen() {
  const { personId } = useLocalSearchParams<{ personId?: string }>();
  const { contacts, startOutgoing } = useCall();
  const backgroundColor = useThemeBackground();
  const person = contacts.find((contact) => contact.id === personId);

  if (!person) {
    return (
      <View style={[styles.missingScreen, { backgroundColor }]}>
        <Stack.Screen options={{ title: 'Contact' }} />
        <ThemedText variant="title">Contact unavailable</ThemedText>
        <ThemedText variant="body" tone="secondary">This contact is no longer in your saved contacts.</ThemedText>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const startCall = (kind: 'voice' | 'video') => {
    void startOutgoing(person, kind);
    router.push({ pathname: '/call', params: { personId: person.id } });
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { backgroundColor }]}
    >
      <Stack.Screen options={{ title: 'Contact' }} />
      <View style={styles.hero}>
        <Avatar initials={person.initials} photoURL={person.photoURL} size="xl" accessibilityLabel={`${person.name} avatar`} />
        <View style={styles.heroCopy}>
          <ThemedText variant="title" style={styles.centerText}>{person.name}</ThemedText>
          <ThemedText variant="body" tone="secondary" style={styles.centerText}>{person.handle}</ThemedText>
          <View style={styles.onlineRow}>
            <View style={styles.onlineDot} />
            <ThemedText variant="caption" tone="secondary">Available for private calls</ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <ContactAction label="Call" ios="phone.fill" android="call" onPress={() => startCall('voice')} />
        <ContactAction label="Video call" ios="video.fill" android="videocam" onPress={() => startCall('video')} />
      </View>

      <View style={styles.infoCard}>
        <ContactInfoRow label="Username" value={person.handle} />
        {person.email ? (
          <>
            <View style={styles.separator} />
            <ContactInfoRow label="Email" value={person.email} />
          </>
        ) : null}
        {person.phoneNumber ? (
          <>
            <View style={styles.separator} />
            <ContactInfoRow label="Phone" value={person.phoneNumber} />
          </>
        ) : null}
        <View style={styles.separator} />
        <ContactInfoRow label="Connection" value="Available for private calls" />
      </View>

      <ThemedText variant="subhead" tone="secondary" style={styles.privacyCopy} selectable>
        Calls are private. Audio and video are not recorded.
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
    backgroundColor: Colors.systemBackground,
  },
  hero: { alignItems: 'center', gap: Spacing.lg },
  heroCopy: { alignItems: 'center', gap: Spacing.xs },
  centerText: { textAlign: 'center' },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  onlineDot: { width: 8, height: 8, borderRadius: Radius.full, backgroundColor: Colors.success },
  actions: { width: '100%', flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
  actionItem: { flex: 1, alignItems: 'center', gap: Spacing.sm, minWidth: 80 },
  actionButton: {
    width: '100%',
    maxWidth: 128,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  actionLabel: { textAlign: 'center' },
  infoCard: {
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.secondaryBackground,
  },
  infoRow: { gap: Spacing.xs, paddingVertical: Spacing.md },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator },
  privacyCopy: { textAlign: 'center' },
  missingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
    backgroundColor: Colors.systemBackground,
  },
});
