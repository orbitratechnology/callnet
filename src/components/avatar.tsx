import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, useBrandColors } from '@/constants/theme';

export type AvatarProps = { initials: string; size?: 'sm' | 'md' | 'lg' };

export function Avatar({ initials, size = 'md' }: AvatarProps) {
  const brand = useBrandColors();

  return (
    <View
      style={[styles.base, styles[size], { backgroundColor: brand.accentSoft }]}
      accessibilityLabel={`${initials} avatar`}
    >
      <ThemedText variant={size === 'lg' ? 'title' : 'headline'} style={{ color: brand.accentContrast }}>
        {initials.slice(0, 2).toUpperCase()}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderRadius: Radius.full },
  sm: { width: 40, height: 40 },
  md: { width: 52, height: 52 },
  lg: { width: 96, height: 96, padding: Spacing.sm },
});
