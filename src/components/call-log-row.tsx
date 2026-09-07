import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/icon-button';
import { Colors, Spacing, useBrandColors, useThemeBackground } from '@/constants/theme';
import type { CallKind } from '@/features/calls/call-state';
import type { RecentCall } from '@/features/recents/recent-call-repository';

export type CallLogRowProps = {
  call: RecentCall;
  dateLabel?: string;
  timeLabel: string;
  onPress: () => void;
  onStartCall?: (kind: CallKind) => void;
};

function getStatusLabel(call: RecentCall) {
  if (call.outcome === 'completed') return 'Call completed';
  if (call.outcome === 'missed') return 'Missed call';
  if (call.outcome === 'timed-out') return 'No answer';
  if (call.outcome === 'rejected') return 'Call declined';
  if (call.outcome === 'cancelled') return 'Call cancelled';
  if (call.outcome === 'failed') return 'Call could not connect';
  return call.direction === 'incoming' ? 'Incoming call' : 'Outgoing call';
}

function getCallTypeLabel(call: RecentCall) {
  return call.kind === 'video' ? 'Video' : 'Voice';
}

function getCallIcon(call: RecentCall): { ios: SFSymbol; android: AndroidSymbol } {
  if (call.outcome === 'missed') {
    return { ios: 'phone.down.fill', android: 'call_missed' };
  }
  return call.direction === 'incoming'
    ? { ios: 'phone.arrow.down.left.fill', android: 'call_received' }
    : { ios: 'phone.arrow.up.right.fill', android: 'call_made' };
}

export const CallLogRow = memo(function CallLogRow({ call, dateLabel, timeLabel, onPress, onStartCall }: CallLogRowProps) {
  const brand = useBrandColors();
  const backgroundColor = useThemeBackground();
  const statusLabel = getStatusLabel(call);
  const callTypeLabel = getCallTypeLabel(call);
  const icon = getCallIcon(call);
  const isAttention = call.outcome === 'missed' || call.outcome === 'failed';
  const isSuccessful = call.outcome === 'completed';
  const statusColor = isAttention ? Colors.destructive : isSuccessful ? Colors.success : brand.accent;
  const accessibleLabel = `${call.person.name}, ${statusLabel}, ${callTypeLabel}, ${timeLabel}`;

  return (
    <View>
      {dateLabel ? <ThemedText variant="subhead" style={styles.dateLabel}>{dateLabel}</ThemedText> : null}
      <View style={[styles.row, { backgroundColor }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibleLabel}
          onPress={onPress}
          style={({ pressed }) => [styles.rowMain, { opacity: pressed ? 0.68 : 1 }]}
        >
          <Avatar
            initials={call.person.initials}
            photoURL={call.person.photoURL}
            size="md"
            accessible={false}
          />
          <View style={styles.copy}>
            <ThemedText
              variant="headline"
              numberOfLines={1}
              style={isAttention ? styles.attentionText : undefined}
            >
              {call.person.name}
            </ThemedText>
            <View style={styles.detailLine}>
              <SymbolView
                name={{ ios: icon.ios, android: icon.android, web: icon.android }}
                size={16}
                tintColor={statusColor}
                fallback={<ThemedText variant="caption" style={styles.iconFallback}>↗</ThemedText>}
              />
              <ThemedText variant="subhead" tone="secondary" numberOfLines={1}>
                {statusLabel} · {callTypeLabel}
              </ThemedText>
            </View>
          </View>
          <ThemedText variant="subhead" tone="secondary" style={styles.timeLabel}>
            {timeLabel}
          </ThemedText>
        </Pressable>
        {onStartCall ? (
          <View style={styles.quickActions}>
            <IconButton
              label={`Call ${call.person.name} by voice`}
              accessibilityLabel={`Voice call ${call.person.name}`}
              style={styles.quickAction}
              icon={<SymbolView name={{ ios: 'phone.fill', android: 'call', web: 'call' }} size={18} tintColor={brand.accentContrast} />}
              onPress={() => onStartCall('voice')}
            />
            <IconButton
              label={`Call ${call.person.name} by video`}
              accessibilityLabel={`Video call ${call.person.name}`}
              style={styles.quickAction}
              icon={<SymbolView name={{ ios: 'video.fill', android: 'videocam', web: 'videocam' }} size={18} tintColor={brand.accentContrast} />}
              onPress={() => onStartCall('video')}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  dateLabel: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    fontWeight: '600',
  },
  row: {
    minHeight: 84,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
    backgroundColor: Colors.systemBackground,
  },
  rowMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.xs,
  },
  detailLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  timeLabel: {
    minWidth: 58,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  quickActions: { flexDirection: 'row', gap: Spacing.xs, marginLeft: Spacing.sm },
  quickAction: { width: 44, height: 44, minWidth: 44, minHeight: 44, paddingHorizontal: 0, backgroundColor: Colors.secondaryBackground },
  attentionText: { color: Colors.destructive },
  successText: { color: Colors.success },
  iconFallback: { color: Colors.secondaryLabel },
});
