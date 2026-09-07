import * as Network from 'expo-network';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';

export function NetworkStatusBanner() {
  const networkState = Network.useNetworkState();
  const insets = useSafeAreaInsets();
  const isOffline = networkState.isConnected === false || networkState.isInternetReachable === false;

  if (!isOffline) {
    return null;
  }

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={[styles.banner, { paddingTop: Math.max(insets.top, Spacing.sm) }]}
    >
      <SymbolView
        name={{ ios: 'wifi.slash', android: 'wifi_off', web: 'wifi_off' }}
        size={16}
        tintColor="#FFFFFF"
      />
      <ThemedText variant="caption" style={styles.label}>No internet connection</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 100,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.destructive,
    borderBottomLeftRadius: Radius.sm,
    borderBottomRightRadius: Radius.sm,
  },
  label: { color: '#FFFFFF' },
});
