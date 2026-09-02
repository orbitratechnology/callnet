import { Color } from 'expo-router';
import { Platform, useColorScheme, type TextStyle } from 'react-native';

export const Colors = {
  label: Platform.select({
    ios: Color.ios.label,
    android: Color.android.dynamic.onSurface,
    default: '#12211F',
  })!,
  secondaryLabel: Platform.select({
    ios: Color.ios.secondaryLabel,
    android: Color.android.dynamic.onSurfaceVariant,
    default: '#61716D',
  })!,
  separator: Platform.select({
    ios: Color.ios.separator,
    android: Color.android.dynamic.outlineVariant,
    default: '#D9E2DF',
  })!,
  systemBackground: Platform.select({
    ios: Color.ios.systemBackground,
    android: Color.android.dynamic.surface,
    default: '#F8FBFA',
  })!,
  secondaryBackground: Platform.select({
    ios: Color.ios.secondarySystemBackground,
    android: Color.android.dynamic.surface,
    default: '#FFFFFF',
  })!,
  destructive: Platform.select({
    ios: Color.ios.systemRed,
    android: Color.android.dynamic.error,
    default: '#C7362F',
  })!,
  onBrand: '#FFFFFF',
} as const;

export const BrandColors = {
  light: { accent: '#111111', accentSoft: '#dddddd', accentContrast: '#0F403A' },
  dark: { accent: '#eeeeee', accentSoft: '#aaaaaa', accentContrast: '#E8FFFA' },
} as const;

export function useBrandColors() {
  const scheme = useColorScheme();
  return BrandColors[scheme === 'dark' ? 'dark' : 'light'];
}

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', rounded: 'normal', mono: 'monospace' },
  web: { sans: 'var(--font-display)', rounded: 'var(--font-rounded)', mono: 'var(--font-mono)' },
});

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Radius = {
  sm: 10,
  md: 16,
  lg: 24,
  full: 999,
} as const;

export const Motion = {
  fast: 150,
  base: 250,
  slow: 400,
} as const;

export const Type = {
  largeTitle: { fontSize: 34, lineHeight: 40, fontWeight: '700', color: Colors.label },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700', color: Colors.label },
  headline: { fontSize: 17, lineHeight: 23, fontWeight: '600', color: Colors.label },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400', color: Colors.label },
  subhead: { fontSize: 14, lineHeight: 20, fontWeight: '400', color: Colors.secondaryLabel },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: Colors.secondaryLabel },
} as const satisfies Record<string, TextStyle>;

export const BottomTabInset = 0;
export const MaxContentWidth = 720;
