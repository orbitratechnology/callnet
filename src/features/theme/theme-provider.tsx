import { DarkTheme, ThemeProvider } from 'expo-router';
import { useEffect, type PropsWithChildren } from 'react';
import { Appearance } from 'react-native';

export function AppThemeProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    Appearance.setColorScheme('dark');
  }, []);

  return (
    <ThemeProvider value={DarkTheme}>
      {children}
    </ThemeProvider>
  );
}
