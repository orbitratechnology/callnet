import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';

export type IconButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  hint?: string;
  icon?: ReactNode;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({ label, hint, icon, active = false, style, disabled = false, ...props }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(active) }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        active ? styles.active : null,
        { opacity: disabled ? 0.45 : pressed ? 0.65 : 1 },
        style,
      ]}
      {...props}
    >
      {icon ?? <ThemedText variant="caption" style={styles.label}>{label}</ThemedText>}
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
  active: { backgroundColor: Colors.separator },
  label: { color: Colors.label },
});
