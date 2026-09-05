import { router } from 'expo-router';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { CallLogRow } from '@/components/call-log-row';
import { KeypadSheet } from '@/components/keypad-sheet';
import { PeopleSearch } from '@/components/people-search';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import {
  Colors,
  MaxContentWidth,
  Radius,
  Shadows,
  Spacing,
  useBrandColors,
  useThemeBackground,
} from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-provider';
import { useCall } from '@/features/calls/call-provider';
import type { CallKind } from '@/features/calls/call-state';
import type { DemoPerson } from '@/features/contacts/demo-people';
import { demoPeople } from '@/features/contacts/demo-people';
import type { RecentCall } from '@/features/recents/recent-call-repository';
import { redactDiagnostic } from '../../../shared/diagnostics';

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
  if (getDateKey(timestamp) === getDateKey(now.getTime())) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (getDateKey(timestamp) === getDateKey(yesterday.getTime())) return 'Yesterday';

  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
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

function FavoritesStrip({
  contacts,
  onPress,
}: {
  contacts: DemoPerson[];
  onPress: (personId: string) => void;
}) {
  if (contacts.length === 0) return null;

  return (
    <View style={styles.favoritesSection}>
      <View style={styles.sectionHeader}>
        <ThemedText variant="headline">Favorites</ThemedText>
        <View style={styles.sectionRule} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.favoritesContent}
        keyboardShouldPersistTaps="handled"
      >
        {contacts.map((person) => (
          <Pressable
            key={person.id}
            accessibilityRole="button"
            accessibilityLabel={`Open ${person.name}'s profile`}
            onPress={() => onPress(person.id)}
            style={({ pressed }) => [styles.favoriteContact, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Avatar initials={person.initials} photoURL={person.photoURL} size="lg" accessible={false} />
            <ThemedText variant="caption" numberOfLines={1} style={styles.favoriteName}>{person.name}</ThemedText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function HomeHeader({
  contacts,
  favoriteContacts,
  getIdToken,
  onStartCall,
  onPressFavorite,
}: {
  contacts: DemoPerson[];
  favoriteContacts: DemoPerson[];
  getIdToken: () => Promise<string>;
  onStartCall: (person: DemoPerson, kind: CallKind) => void;
  onPressFavorite: (personId: string) => void;
}) {
  return (
    <View style={styles.headerContent}>
      <PeopleSearch contacts={contacts} getIdToken={getIdToken} onStartCall={onStartCall} />
      <FavoritesStrip contacts={favoriteContacts} onPress={onPressFavorite} />
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
          <ThemedText variant="caption" tone="brand">PRIVATE BY DESIGN</ThemedText>
          <ThemedText variant="subhead" tone="secondary" selectable>Your call history stays on this device.</ThemedText>
        </View>
      </View>
      <View style={styles.demoNote}>
        <ThemedText variant="caption" tone="secondary">LOCAL DEMO MODE</ThemedText>
        <ThemedText variant="subhead" tone="secondary">Exercise an incoming call flow without another device.</ThemedText>
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
  const statusLabel = status === 'connected'
    ? 'CONNECTED'
    : status === 'connecting'
      ? 'CONNECTING…'
      : 'OFFLINE';
  const diagnostic = error ? redactDiagnostic(error) : null;
  const statusCopy = status === 'connected'
    ? 'Ready for secure calls with your Firebase identity.'
    : status === 'connecting'
      ? 'Connecting to the calling service.'
      : 'The calling service is unavailable. Check your connection.';

  return (
    <View style={styles.footerContent}>
      <View style={styles.footerRule} />
      <View style={styles.footerRow}>
        <View style={[styles.statusDot, status === 'connected' ? styles.statusDotOnline : styles.statusDotOffline]} />
        <View style={styles.footerCopy}>
          <ThemedText variant="caption" tone={status === 'connected' ? 'brand' : 'secondary'}>
            AUTHENTICATED WEBRTC · {statusLabel}
          </ThemedText>
          <ThemedText variant="subhead" tone="secondary" selectable>{statusCopy}</ThemedText>
          {__DEV__ && diagnostic ? (
            <ThemedText variant="caption" tone="secondary" selectable>{`Diagnostic: ${diagnostic}`}</ThemedText>
          ) : null}
        </View>
      </View>
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
  );
}

function KeypadButton({ onPress }: { onPress: () => void }) {
  const brand = useBrandColors();
  const insets = useSafeAreaInsets();
  const icon: { ios: SFSymbol; android: AndroidSymbol } = { ios: 'circle.grid.3x3.fill', android: 'dialpad' };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open keypad"
      onPress={onPress}
      style={({ pressed }) => [
        styles.keypadButton,
        { backgroundColor: brand.accent, opacity: pressed ? 0.8 : 1, bottom: insets.bottom + 30 },
      ]}
    >
      <SymbolView
        name={{ ios: icon.ios, android: icon.android, web: icon.android }}
        size={24}
        tintColor={brand.onAccent}
        fallback={<ThemedText variant="title" style={{ color: brand.onAccent }}>#</ThemedText>}
      />
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const backgroundColor = useThemeBackground();
  const { getIdToken } = useAuth();
  const [keypadVisible, setKeypadVisible] = useState(false);
  const {
    contacts,
    recentCalls,
    simulateIncoming,
    startOutgoing,
    transportMode,
    transportStatus,
    transportError,
    retryConnection,
  } = useCall();

  const startDemoIncomingCall = useCallback(() => {
    simulateIncoming(demoPeople[0], 'voice');
    router.push('/incoming');
  }, [simulateIncoming]);

  const openCall = useCallback((personId: string) => {
    router.push({ pathname: '/call', params: { personId } });
  }, []);
  const openFavorite = useCallback((personId: string) => {
    router.push({ pathname: '/contact/[personId]', params: { personId } });
  }, []);
  const startCall = useCallback((person: DemoPerson, kind: CallKind) => {
    void startOutgoing(person, kind);
    router.push({ pathname: '/call', params: { personId: person.id } });
  }, [startOutgoing]);
  const favoriteContacts = useMemo(() => {
    const recentIds = new Set(recentCalls.map((call) => call.person.id));
    return [
      ...contacts.filter((person) => recentIds.has(person.id)),
      ...contacts.filter((person) => !recentIds.has(person.id)),
    ].slice(0, 8);
  }, [contacts, recentCalls]);
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

  return (
    <View style={[styles.screen, { backgroundColor }]}>
      <FlatList
        data={recentCalls}
        keyExtractor={(call) => call.id}
        renderItem={renderRecentCall}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 120 }]}
        ListHeaderComponent={
          <HomeHeader
            contacts={contacts}
            favoriteContacts={favoriteContacts}
            getIdToken={getIdToken}
            onStartCall={startCall}
            onPressFavorite={openFavorite}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <ThemedText variant="headline">Your recent calls will appear here.</ThemedText>
            <ThemedText variant="subhead" tone="secondary">Use the keypad below to start your first call.</ThemedText>
          </View>
        }
        ListFooterComponent={
          transportMode === 'demo'
            ? <HomeFooter onIncomingCall={startDemoIncomingCall} />
            : <WebRTCFooter error={transportError} status={transportStatus} onRetry={() => void retryConnection()} />
        }
      />
      <KeypadButton onPress={() => setKeypadVisible(true)} />
      <KeypadSheet
        visible={keypadVisible}
        contacts={contacts}
        getIdToken={getIdToken}
        onClose={() => setKeypadVisible(false)}
        onStartCall={startCall}
      />
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
  favoritesSection: { gap: Spacing.md },
  favoritesContent: { gap: Spacing.lg, paddingRight: Spacing.lg, paddingVertical: Spacing.xs },
  favoriteContact: { width: 68, alignItems: 'center', gap: Spacing.xs },
  favoriteName: { maxWidth: 68, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator },
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
  statusDotOnline: { backgroundColor: Colors.success },
  statusDotOffline: { backgroundColor: Colors.destructive },
  footerCopy: { flex: 1, gap: Spacing.xs },
  demoNote: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.secondaryBackground,
    boxShadow: Shadows.card,
  },
  keypadButton: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: 72,
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    boxShadow: Shadows.floating,
  },
});
