import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, useBrandColors } from '@/constants/theme';
import { strings } from '@/localization/strings';
import type { RecentCall } from '@/features/recents/recent-call-repository';

export type CallLogRowProps = {
  call: RecentCall;
  dateLabel?: string;
  timeLabel: string;
  onPress: () => void;
};

function getStatusLabel(call: RecentCall) {
  if (call.outcome === 'completed') return strings.home.callStatuses.completed;
  if (call.outcome === 'missed') return strings.home.callStatuses.missed;
  if (call.outcome === 'timed-out') return strings.home.callStatuses.timedOut;
  if (call.outcome === 'rejected') return strings.home.callStatuses.rejected;
  if (call.outcome === 'cancelled') return strings.home.callStatuses.cancelled;
  if (call.outcome === 'failed') return strings.home.callStatuses.failed;
  return call.direction === 'incoming' ? strings.home.callStatuses.incoming : strings.home.callStatuses.outgoing;
}

function getCallTypeLabel(call: RecentCall) {
  return call.kind === 'video' ? strings.home.callTypes.video : strings.home.callTypes.voice;
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
  const statusLabel = getStatusLabel(call);
  const callTypeLabel = getCallTypeLabel(call);
  const icon = getCallIcon(call);
  const isAttention = call.outcome === 'missed' || call.outcome === 'failed';
  const accessibleLabel = `${call.person.name}, ${statusLabel}, ${callTypeLabel}, ${timeLabel}`;

  return (
    <View>
      {dateLabel ? <ThemedText variant="subhead" style={styles.dateLabel}>{dateLabel}</ThemedText> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibleLabel}
        onPress={onPress}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.68 : 1 }]}
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
              tintColor={isAttention ? Colors.destructive : brand.accent}
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
  iconFallback: { color: Colors.secondaryLabel },
});
