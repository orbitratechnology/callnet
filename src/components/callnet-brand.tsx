import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';

declare const require: (moduleName: string) => number;

const callnetIcon = require('../../assets/callnet-icon.png');

export function CallnetBrand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.brand, compact ? styles.compactBrand : null]} accessible accessibilityRole="image" accessibilityLabel="Callnet">
      <Image source={callnetIcon} style={[styles.icon, compact ? styles.compactIcon : null]} contentFit="contain" accessibilityIgnoresInvertColors />
      {!compact ? <ThemedText variant="headline" style={styles.wordmark}>Callnet</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: 0,
    borderRadius: Radius.md,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: Radius.sm,
    backgroundColor: '#000000',
  },
  wordmark: { color: Colors.label },
  compactBrand: { width: 44, justifyContent: 'center' },
  compactIcon: { width: 40, height: 40 },
});
