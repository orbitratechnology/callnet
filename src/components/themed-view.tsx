import { View, type ViewProps } from 'react-native';

import { useThemeBackground } from '@/constants/theme';

export function ThemedView({ style, ...otherProps }: ViewProps) {
  const backgroundColor = useThemeBackground();
  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
