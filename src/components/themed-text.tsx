import { Text, type TextProps } from 'react-native';

import { Colors, Type, useBrandColors } from '@/constants/theme';

export type TextVariant = keyof typeof Type;

export type ThemedTextProps = TextProps & {
  variant?: TextVariant;
  tone?: 'default' | 'secondary' | 'destructive' | 'brand';
};

export function ThemedText({ style, variant = 'body', tone = 'default', ...rest }: ThemedTextProps) {
  const brand = useBrandColors();
  const toneColor =
    tone === 'secondary'
      ? Colors.secondaryLabel
      : tone === 'destructive'
        ? Colors.destructive
        : tone === 'brand'
          ? brand.accent
          : Colors.label;

  return <Text style={[Type[variant], { color: toneColor }, style]} {...rest} />;
}
