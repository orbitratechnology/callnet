import { Stack } from 'expo-router/stack';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { NetworkStatusBanner } from '@/components/network-status-banner';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, useThemeBackground } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import type { AuthUser } from '@/features/auth/auth-service';
import { AuthScreen } from '@/features/auth/auth-screen';
import { CallProvider } from '@/features/calls/call-provider';
import { getUserProfile } from '@/features/profile/profile-service';
import { PhoneNumberScreen } from '@/features/profile/phone-number-screen';
import { AppThemeProvider } from '@/features/theme/theme-provider';

function LoadingScreen() {
  const backgroundColor = useThemeBackground();

  return (
    <View style={[styles.loadingScreen, { backgroundColor }]}>
      <ThemedText variant="title">Callnet</ThemedText>
      <ThemedText variant="body" tone="secondary">Getting your calls ready…</ThemedText>
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

function ProfileGate({ user }: { user: AuthUser }) {
  const [state, setState] = useState<'loading' | 'ready' | 'needs-phone' | 'error'>('loading');
  const backgroundColor = useThemeBackground();

  const loadProfile = useCallback(async () => {
    setState('loading');
    try {
      const profile = await getUserProfile(user.uid);
      setState(profile?.phoneNumber ? 'ready' : 'needs-phone');
    } catch {
      setState('error');
    }
  }, [user.uid]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (state === 'loading') {
    return <LoadingScreen />;
  }
  if (state === 'error') {
    return (
      <View style={[styles.loadingScreen, { backgroundColor }]}>
        <ThemedText variant="title">We couldn’t load your account</ThemedText>
        <ThemedText variant="body" tone="secondary" style={styles.centerText}>
          Check your connection and try again.
        </ThemedText>
        <Button title="Try again" onPress={() => void loadProfile()} />
      </View>
    );
  }
  if (state === 'needs-phone') {
    return <PhoneNumberScreen onSaved={() => void loadProfile()} />;
  }
  return <CallStack />;
}

function RootContent() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return <LoadingScreen />;
  }
  if (!user) {
    return <AuthScreen />;
  }
  return <ProfileGate user={user} />;
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <NetworkStatusBanner />
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
  centerText: { maxWidth: 360, textAlign: 'center' },
});
