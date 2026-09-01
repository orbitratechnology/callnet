import { View, type ViewProps } from 'react-native';

import { Colors } from '@/constants/theme';

export function ThemedView({ style, ...otherProps }: ViewProps) {
  return <View style={[{ backgroundColor: Colors.systemBackground }, style]} {...otherProps} />;
}
