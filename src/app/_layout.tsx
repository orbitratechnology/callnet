import { Stack } from 'expo-router/stack';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, useThemeBackground } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { AuthScreen } from '@/features/auth/auth-screen';
import { CallProvider } from '@/features/calls/call-provider';
import { AppThemeProvider } from '@/features/theme/theme-provider';

function LoadingScreen() {
  const backgroundColor = useThemeBackground();

  return (
    <View style={[styles.loadingScreen, { backgroundColor }]}>
      <ThemedText variant="title">Callnet</ThemedText>
      <ThemedText variant="body" tone="secondary">Restoring your secure session…</ThemedText>
    </View>
  );
}

function CallStack() {
  const backgroundColor = useThemeBackground();

  return (
    <CallProvider>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor },
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="contact/[personId]" options={{ title: 'Contact' }} />
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
  return (
    <AppThemeProvider>
      <AuthProvider>
        <RootContent />
      </AuthProvider>
    </AppThemeProvider>
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
