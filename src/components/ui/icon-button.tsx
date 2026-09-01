import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';

export type IconButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  hint?: string;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({ label, hint, style, ...props }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.65 : 1 }, style]}
      {...props}
    >
      <ThemedText variant="caption" style={styles.label}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondaryBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
  },
  label: { color: Colors.label },
});
