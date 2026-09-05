import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

declare const require: (moduleName: string) => number;

const callnetIcon = require('../../assets/callnet-icon.png');

export function CallnetBrand() {
  return (
    <View style={styles.brand} accessible accessibilityRole="image" accessibilityLabel="Callnet">
      <Image source={callnetIcon} style={styles.icon} contentFit="contain" accessibilityIgnoresInvertColors />
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
    width: 56,
    height: 56,
    borderRadius: Radius.sm,
    backgroundColor: '#000000',
  },
  wordmark: { color: Colors.label },
});
