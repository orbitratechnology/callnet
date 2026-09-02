import { router, Stack } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { PersonRow } from '@/components/person-row';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { demoPeople } from '@/features/contacts/demo-people';
import { useCall } from '@/features/calls/call-provider';
import type { RecentCall } from '@/features/recents/recent-call-repository';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';

function getRecentCallDetail(call: RecentCall) {
  const kind = call.kind === 'video' ? 'Video' : 'Voice';
  const outcome = call.outcome === 'completed' ? 'Completed' : call.outcome;
  return `${kind} · ${outcome}`;
}

function HomeHeader({ onStartCall, onProfile }: { onStartCall: () => void; onProfile: () => void }) {
  return (
    <View style={styles.headerContent}>
      <View style={styles.intro}>
        <ThemedText variant="title">Private calls, made simple.</ThemedText>
        <ThemedText variant="body" tone="secondary" selectable>
          Find someone you know and connect in a single focused flow.
        </ThemedText>
      </View>

      <Button title="Start a call" size="lg" onPress={onStartCall} />

      <View style={styles.sectionHeader}>
        <ThemedText variant="headline">Recent</ThemedText>
        <IconButton label="Profile" onPress={onProfile} />
      </View>
    </View>
  );
}

function HomeFooter({ onIncomingCall }: { onIncomingCall: () => void }) {
  return (
    <View style={styles.footerContent}>
      <View style={styles.privacyNote}>
        <ThemedText variant="caption" tone="brand">PRIVATE BY DESIGN</ThemedText>
        <ThemedText variant="subhead" tone="secondary" selectable>
          A calm, focused calling space with privacy details kept clear and factual.
        </ThemedText>
      </View>
      <View style={styles.demoNote}>
        <ThemedText variant="caption" tone="secondary">LOCAL DEMO MODE</ThemedText>
        <ThemedText variant="subhead" tone="secondary">
          Try an incoming call to exercise the accept, reject, and end flow.
        </ThemedText>
        <Button title="Try incoming call" variant="secondary" size="sm" onPress={onIncomingCall} />
      </View>
    </View>
  );
}

function WebRTCFooter({ error }: { error: string | null }) {
  return (
    <View style={styles.footerContent}>
      <View style={styles.privacyNote}>
        <ThemedText variant="caption" tone="brand">AUTHENTICATED WEBRTC MODE</ThemedText>
        <ThemedText variant="subhead" tone="secondary" selectable>
          Calls use your Firebase identity and a secure Socket.IO signaling connection.
        </ThemedText>
        {error ? <ThemedText variant="caption" tone="destructive">{error}</ThemedText> : null}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { recentCalls, simulateIncoming, transportMode, transportError } = useCall();

  const startDemoIncomingCall = () => {
    simulateIncoming(demoPeople[0], 'voice');
    router.push('/call');
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Callnet', headerLargeTitle: true }} />
      <FlatList
        data={recentCalls}
        keyExtractor={(call) => call.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={RecentSeparator}
        ListHeaderComponent={
          <HomeHeader
            onStartCall={() => router.push('/select-person')}
            onProfile={() => router.push('/profile')}
          />
        }
        ListEmptyComponent={
          <ThemedText variant="body" tone="secondary" style={styles.emptyText}>
            Your recent calls will appear here.
          </ThemedText>
        }
        renderItem={({ item }) => (
          <PersonRow
            name={item.person.name}
            initials={item.person.initials}
            detail={getRecentCallDetail(item)}
            onPress={() => router.push({ pathname: '/call', params: { personId: item.person.id } })}
          />
        )}
        ListFooterComponent={
          transportMode === 'demo'
            ? <HomeFooter onIncomingCall={startDemoIncomingCall} />
            : <WebRTCFooter error={transportError} />
        }
      />
    </>
  );
}

function RecentSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: Spacing.lg, paddingBottom: Spacing.xxl },
  headerContent: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.xl },
  intro: { gap: Spacing.sm, paddingTop: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  separator: { height: Spacing.sm },
  emptyText: { paddingVertical: Spacing.md },
  footerContent: { gap: Spacing.md, paddingTop: Spacing.xl },
  privacyNote: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.secondaryBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
  },
  demoNote: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.secondaryBackground,
  },
});
