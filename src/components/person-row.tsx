import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';

export type PersonRowProps = {
  name: string;
  initials: string;
  photoURL?: string | null;
  detail?: string;
  onPress?: () => void;
};

export function PersonRow({ name, initials, photoURL, detail, onPress }: PersonRowProps) {
  const accessibleDetail = detail?.replace(/\n/g, ', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibleDetail ? `${name}, ${accessibleDetail}` : name}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.72 : 1 }]}
    >
      <Avatar initials={initials} photoURL={photoURL} size="sm" />
      <View style={styles.copy}>
        <ThemedText variant="headline">{name}</ThemedText>
        {detail ? <ThemedText variant="subhead" tone="secondary" numberOfLines={2}>{detail}</ThemedText> : null}
      </View>
      <ThemedText variant="headline" tone="secondary" accessibilityLabel="Open">›</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
    backgroundColor: Colors.secondaryBackground,
  },
  copy: { flex: 1, gap: Spacing.xs },
});
