import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing, useBrandColors, useThemeBackground } from '@/constants/theme';
import type { RecentCall } from '@/features/recents/recent-call-repository';

export type CallLogRowProps = {
  call: RecentCall;
  dateLabel?: string;
  timeLabel: string;
  onPress: () => void;
};

function getStatusLabel(call: RecentCall) {
  if (call.outcome === 'completed') return 'Completed call';
  if (call.outcome === 'missed') return 'Missed call';
  if (call.outcome === 'timed-out') return 'Timed out call';
  if (call.outcome === 'rejected') return 'Declined call';
  if (call.outcome === 'cancelled') return 'Cancelled call';
  if (call.outcome === 'failed') return 'Failed call';
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

export const CallLogRow = memo(function CallLogRow({ call, dateLabel, timeLabel, onPress }: CallLogRowProps) {
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibleLabel}
        onPress={onPress}
        style={({ pressed }) => [styles.row, { backgroundColor, opacity: pressed ? 0.68 : 1 }]}
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
    minHeight: 76,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
    backgroundColor: Colors.systemBackground,
  },
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
    minWidth: 68,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  attentionText: { color: Colors.destructive },
  successText: { color: Colors.success },
  iconFallback: { color: Colors.secondaryLabel },
});
