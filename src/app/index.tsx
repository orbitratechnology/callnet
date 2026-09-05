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
  const direction = call.direction === 'incoming' ? 'Incoming' : 'Outgoing';
  const outcome =
    call.outcome === 'completed'
      ? 'Completed'
      : call.outcome === 'timed-out'
        ? 'Timed out'
        : call.outcome === 'rejected'
          ? 'Declined'
          : call.outcome.charAt(0).toUpperCase() + call.outcome.slice(1);
  const title = call.outcome === 'missed' ? `Missed · ${kind}` : `${direction} · ${kind}`;

  return `${title}\n${formatRecentCallTimestamp(call.timestamp)} · ${outcome}`;
}

function formatRecentCallTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return `Today, ${time}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isYesterday) {
    return `Yesterday, ${time}`;
  }

  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
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

function WebRTCFooter({
  error,
  status,
  onRetry,
}: {
  error: string | null;
  status: 'connecting' | 'connected' | 'offline';
  onRetry: () => void;
}) {
  const statusLabel = status === 'connected' ? 'CONNECTED' : status === 'connecting' ? 'CONNECTING…' : 'OFFLINE';
  const statusCopy = status === 'connected'
    ? 'Calls use your Firebase identity and a secure WebSocket signaling connection.'
    : status === 'connecting'
      ? 'Connecting to the calling service. You can retry if this takes too long.'
      : 'The calling service is unavailable. Check your connection and try again.';

  return (
    <View style={styles.footerContent}>
      <View style={styles.privacyNote}>
        <ThemedText variant="caption" tone={status === 'connected' ? 'brand' : 'secondary'}>
          AUTHENTICATED WEBRTC · {statusLabel}
        </ThemedText>
        <ThemedText variant="subhead" tone="secondary" selectable>{statusCopy}</ThemedText>
        {__DEV__ && error ? <ThemedText variant="caption" tone="secondary" selectable>Diagnostic: {error}</ThemedText> : null}
        {status !== 'connected' ? (
          <Button
            title="Retry connection"
            variant="secondary"
            size="sm"
            loading={status === 'connecting'}
            disabled={status === 'connecting'}
            onPress={onRetry}
          />
        ) : null}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { recentCalls, simulateIncoming, transportMode, transportStatus, transportError, retryConnection } = useCall();

  const startDemoIncomingCall = () => {
    simulateIncoming(demoPeople[0], 'voice');
    router.push('/incoming');
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
            photoURL={item.person.photoURL}
            detail={getRecentCallDetail(item)}
            onPress={() => router.push({ pathname: '/call', params: { personId: item.person.id } })}
          />
        )}
        ListFooterComponent={
          transportMode === 'demo'
            ? <HomeFooter onIncomingCall={startDemoIncomingCall} />
            : <WebRTCFooter error={transportError} status={transportStatus} onRetry={() => void retryConnection()} />
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
