import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, useBrandColors } from '@/constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  ...props
}: ButtonProps) {
  const brand = useBrandColors();
  const palette = {
    primary: { backgroundColor: brand.accent, color: Colors.onBrand },
    secondary: { backgroundColor: brand.accentSoft, color: brand.accentContrast },
    ghost: { backgroundColor: 'transparent', color: brand.accent },
    destructive: { backgroundColor: Colors.destructive, color: Colors.onBrand },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        styles[size],
        { backgroundColor: palette.backgroundColor, opacity: disabled ? 0.45 : pressed ? 0.78 : 1 },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={palette.color as string} />
      ) : (
        <ThemedText variant="headline" style={{ color: palette.color, textAlign: 'center' }}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    minHeight: 48,
  },
  sm: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 40 },
  md: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  lg: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, minHeight: 56 },
});
