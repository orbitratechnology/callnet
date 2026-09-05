import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { CallProvider } from '@/features/calls/call-provider';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { AuthScreen } from '@/features/auth/auth-screen';

function LoadingScreen() {
  return (
    <View style={styles.loadingScreen}>
      <ThemedText variant="title">Callnet</ThemedText>
      <ThemedText variant="body" tone="secondary">Restoring your secure session…</ThemedText>
    </View>
  );
}

function CallStack() {
  return (
    <CallProvider>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: Colors.systemBackground },
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Callnet', headerLargeTitle: true }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="select-person" options={{ title: 'Start a call', presentation: 'formSheet' }} />
        <Stack.Screen name="incoming" options={{ title: 'Incoming Call', headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="call" options={{ title: 'Call', headerShown: false, presentation: 'fullScreenModal' }} />
      </Stack>
    </CallProvider>
  );
}

function RootContent() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return <LoadingScreen />;
  }
  if (!user) {
    return <AuthScreen />;
  }
  return <CallStack />;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <RootContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.systemBackground,
  },
});
