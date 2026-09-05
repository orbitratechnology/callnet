import { router, Stack } from 'expo-router';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { memo, useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { CallLogRow } from '@/components/call-log-row';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { demoPeople, getInitials } from '@/features/contacts/demo-people';
import { useAuth } from '@/features/auth/auth-provider';
import { useCall } from '@/features/calls/call-provider';
import type { RecentCall } from '@/features/recents/recent-call-repository';
import { Colors, MaxContentWidth, Radius, Shadows, Spacing, useBrandColors } from '@/constants/theme';
import { strings } from '@/localization/strings';
import { redactDiagnostic } from '../../shared/diagnostics';

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function getDateKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatDateLabel(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  if (getDateKey(timestamp) === getDateKey(now.getTime())) return strings.home.dateToday;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (getDateKey(timestamp) === getDateKey(yesterday.getTime())) return strings.home.dateYesterday;

  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function HeaderProfileButton({
  displayName,
  photoURL,
  onPress,
}: {
  displayName: string;
  photoURL?: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={strings.home.profile}
      onPress={onPress}
      style={({ pressed }) => [styles.headerAvatarButton, { opacity: pressed ? 0.68 : 1 }]}
    >
      <Avatar initials={getInitials(displayName)} photoURL={photoURL} size="sm" accessible={false} />
    </Pressable>
  );
}

const RecentCallItem = memo(function RecentCallItem({
  call,
  previousTimestamp,
  onPress,
}: {
  call: RecentCall;
  previousTimestamp?: number;
  onPress: () => void;
}) {
  const showDate = previousTimestamp === undefined || getDateKey(previousTimestamp) !== getDateKey(call.timestamp);
  return (
    <CallLogRow
      call={call}
      dateLabel={showDate ? formatDateLabel(call.timestamp) : undefined}
      timeLabel={formatTime(call.timestamp)}
      onPress={onPress}
    />
  );
});

function HomeHeader() {
  return (
    <View style={styles.headerContent}>
      <View style={styles.intro}>
        <ThemedText variant="title">{strings.home.introTitle}</ThemedText>
        <ThemedText variant="body" tone="secondary" selectable>
          {strings.home.introCopy}
        </ThemedText>
      </View>
      <View style={styles.sectionHeader}>
        <ThemedText variant="headline">{strings.home.recent}</ThemedText>
        <View style={styles.sectionRule} />
      </View>
    </View>
  );
}

function HomeFooter({ onIncomingCall }: { onIncomingCall: () => void }) {
  return (
    <View style={styles.footerContent}>
      <View style={styles.footerRule} />
      <View style={styles.footerRow}>
        <View style={styles.statusDot} />
        <View style={styles.footerCopy}>
          <ThemedText variant="caption" tone="brand">{strings.home.privateByDesign}</ThemedText>
          <ThemedText variant="subhead" tone="secondary" selectable>{strings.home.privacyCopy}</ThemedText>
        </View>
      </View>
      <View style={styles.demoNote}>
        <ThemedText variant="caption" tone="secondary">{strings.home.demoMode}</ThemedText>
        <ThemedText variant="subhead" tone="secondary">{strings.home.demoCopy}</ThemedText>
        <Button title={strings.home.tryIncoming} variant="secondary" size="sm" onPress={onIncomingCall} />
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
  const statusLabel = status === 'connected'
    ? strings.home.statuses.connected
    : status === 'connecting'
      ? strings.home.statuses.connecting
      : strings.home.statuses.offline;
  const diagnostic = error ? redactDiagnostic(error) : null;
  const statusCopy = strings.home.statusCopy[status];

  return (
    <View style={styles.footerContent}>
      <View style={styles.footerRule} />
      <View style={styles.footerRow}>
        <View style={[styles.statusDot, status === 'connected' ? styles.statusDotOnline : styles.statusDotOffline]} />
        <View style={styles.footerCopy}>
          <ThemedText variant="caption" tone={status === 'connected' ? 'brand' : 'secondary'}>
            {strings.home.authenticated} · {statusLabel}
          </ThemedText>
          <ThemedText variant="subhead" tone="secondary" selectable>{statusCopy}</ThemedText>
          {__DEV__ && diagnostic ? (
            <ThemedText variant="caption" tone="secondary" selectable>{strings.home.diagnostic(diagnostic)}</ThemedText>
          ) : null}
        </View>
      </View>
      {status !== 'connected' ? (
        <Button
          title={strings.home.retry}
          variant="secondary"
          size="sm"
          loading={status === 'connecting'}
          disabled={status === 'connecting'}
          onPress={onRetry}
        />
      ) : null}
    </View>
  );
}

function StartCallFab({ onPress }: { onPress: () => void }) {
  const brand = useBrandColors();
  const icon: { ios: SFSymbol; android: AndroidSymbol } = { ios: 'phone.badge.plus', android: 'add' };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={strings.home.startCall}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: brand.accent, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <SymbolView
        name={{ ios: icon.ios, android: icon.android, web: icon.android }}
        size={24}
        tintColor={Colors.onBrand}
        fallback={<ThemedText variant="title" style={styles.fabFallback}>+</ThemedText>}
      />
    </Pressable>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { recentCalls, simulateIncoming, transportMode, transportStatus, transportError, retryConnection } = useCall();

  const startDemoIncomingCall = useCallback(() => {
    simulateIncoming(demoPeople[0], 'voice');
    router.push('/incoming');
  }, [simulateIncoming]);

  const openProfile = useCallback(() => router.push('/profile'), []);
  const openCall = useCallback((personId: string) => {
    router.push({ pathname: '/call', params: { personId } });
  }, []);
  const renderRecentCall = useCallback(
    ({ item, index }: { item: RecentCall; index: number }) => (
      <RecentCallItem
        call={item}
        previousTimestamp={recentCalls[index - 1]?.timestamp}
        onPress={() => openCall(item.person.id)}
      />
    ),
    [openCall, recentCalls],
  );

  const profileName = user?.displayName ?? user?.email ?? 'User';

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: strings.home.screenTitle,
          headerLargeTitle: true,
          headerRight: () => (
            <HeaderProfileButton displayName={profileName} photoURL={user?.photoURL} onPress={openProfile} />
          ),
        }}
      />
      <FlatList
        data={recentCalls}
        keyExtractor={(call) => call.id}
        renderItem={renderRecentCall}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 120 }]}
        ListHeaderComponent={<HomeHeader />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <ThemedText variant="headline">{strings.home.empty}</ThemedText>
            <ThemedText variant="subhead" tone="secondary">{strings.home.emptyHint}</ThemedText>
          </View>
        }
        ListFooterComponent={
          transportMode === 'demo'
            ? <HomeFooter onIncomingCall={startDemoIncomingCall} />
            : <WebRTCFooter error={transportError} status={transportStatus} onRetry={() => void retryConnection()} />
        }
      />
      <StartCallFab onPress={() => router.push('/select-person')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.systemBackground },
  listContent: { flexGrow: 1, paddingTop: Spacing.sm },
  headerContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  intro: { gap: Spacing.sm, paddingTop: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator },
  headerAvatarButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  emptyState: {
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  footerContent: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  footerRule: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator },
  footerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  statusDot: {
    width: 8,
    height: 8,
    marginTop: 5,
    borderRadius: Radius.full,
    backgroundColor: '#D9A441',
  },
  statusDotOnline: { backgroundColor: '#46A982' },
  statusDotOffline: { backgroundColor: Colors.destructive },
  footerCopy: { flex: 1, gap: Spacing.xs },
  demoNote: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.secondaryBackground,
    boxShadow: Shadows.card,
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.lg,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    boxShadow: Shadows.floating,
  },
  fabFallback: { color: Colors.onBrand },
});
