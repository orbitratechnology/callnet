import { Platform, type TextStyle } from 'react-native';

export const Colors = {
  label: '#FFFFFF',
  secondaryLabel: '#A5A5A5',
  separator: '#2A2A2A',
  systemBackground: '#000000',
  secondaryBackground: '#161616',
  destructive: '#FF544D',
  success: '#46A982',
} as const;

export const BrandColors = {
  accent: '#FFFFFF',
  accentSoft: '#2A2A2A',
  accentContrast: '#FFFFFF',
  onAccent: '#000000',
} as const;

export const CallColors = {
  background: '#000000',
  surface: 'rgba(24, 24, 24, 0.9)',
  surfaceStrong: 'rgba(32, 32, 32, 0.96)',
  border: 'rgba(255, 255, 255, 0.18)',
  onSurface: '#FFFFFF',
  onSurfaceSecondary: '#B8B8B8',
  onSurfaceMuted: '#858585',
  controlBackground: '#FFFFFF',
  controlForeground: '#000000',
  endCall: '#E5544F',
} as const;

export function useBrandColors() {
  return BrandColors;
}

export function useThemeBackground() {
  return Colors.systemBackground;
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

export const Shadows = {
  card: '0 1px 2px rgba(15, 64, 58, 0.08)',
  raised: '0 6px 18px rgba(15, 64, 58, 0.16)',
  floating: '0 8px 24px rgba(15, 64, 58, 0.22)',
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
