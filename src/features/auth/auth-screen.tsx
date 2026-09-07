import { useState } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { GoogleSignInButton } from 'react-native-nitro-google-signin';

import { ThemedText } from '@/components/themed-text';
import { CallnetBrand } from '@/components/callnet-brand';
import { Button } from '@/components/ui/button';
import {
  Colors,
  MaxContentWidth,
  Radius,
  Shadows,
  Spacing,
  useThemeBackground,
} from '@/constants/theme';
import { useAuth } from './auth-provider';
import { getAuthErrorMessage } from './auth-service';

export function AuthScreen() {
  const { signInWithGoogle, signInWithEmail, createEmailAccount } = useAuth();
  const backgroundColor = useThemeBackground();
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (isCreateMode && !displayName.trim()) {
      setError('Enter a display name.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      if (isCreateMode) {
        await createEmailAccount(email.trim(), password, displayName.trim());
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setIsCreateMode((current) => !current);
    setError(null);
  };

  const signInGoogle = async () => {
    setError(null);
    setIsGoogleSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (googleError) {
      setError(getAuthErrorMessage(googleError));
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor }]}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.shell}>
          <View style={styles.header}>
            <CallnetBrand />
            <View style={styles.intro}>
              <ThemedText variant="largeTitle">
                {isCreateMode ? 'Create your Callnet account' : 'Welcome to Callnet'}
              </ThemedText>
              <ThemedText variant="body" tone="secondary" selectable>
                {isCreateMode
                  ? 'Choose a simple identity so your contacts know it’s you.'
                  : 'Private calls with the people you know, across your devices.'}
              </ThemedText>
            </View>
          </View>

          <View style={styles.formCard}>
            {process.env.EXPO_OS === 'web' ? (
              <Button
                title="Continue with Google"
                variant="secondary"
                size="lg"
                loading={isGoogleSubmitting}
                disabled={isSubmitting}
                onPress={() => void signInGoogle()}
              />
            ) : (
              <GoogleSignInButton
                signInBehavior="none"
                colorScheme="dark"
                size="wide"
                contentAlignment="center"
                loading={isGoogleSubmitting}
                disabled={isSubmitting}
                accessibilityLabel="Continue with Google"
                style={styles.googleButton}
                onPress={() => void signInGoogle()}
              />
            )}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <ThemedText variant="caption" tone="secondary">OR USE EMAIL</ThemedText>
              <View style={styles.dividerLine} />
            </View>

            {isCreateMode ? (
              <View style={styles.field}>
                <ThemedText variant="caption" tone="secondary">Display name</ThemedText>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="How people will see you"
                  placeholderTextColor={Colors.secondaryLabel}
                  style={[styles.input, { backgroundColor }]}
                  accessibilityLabel="Display name"
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            ) : null}
            <View style={styles.field}>
              <ThemedText variant="caption" tone="secondary">Email</ThemedText>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={Colors.secondaryLabel}
                style={[styles.input, { backgroundColor }]}
                accessibilityLabel="Email"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="next"
              />
            </View>
            <View style={styles.field}>
              <ThemedText variant="caption" tone="secondary">Password</ThemedText>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={isCreateMode ? 'At least 6 characters' : 'Your password'}
                placeholderTextColor={Colors.secondaryLabel}
                style={[styles.input, { backgroundColor }]}
                accessibilityLabel="Password"
                secureTextEntry
                textContentType={isCreateMode ? 'newPassword' : 'password'}
                returnKeyType="done"
                onSubmitEditing={() => void submit()}
              />
            </View>

            {error ? (
              <View style={styles.errorBox} accessible accessibilityRole="alert">
                <ThemedText variant="caption" tone="destructive">Couldn’t continue</ThemedText>
                <ThemedText variant="subhead" tone="destructive" selectable>{error}</ThemedText>
              </View>
            ) : null}

            <Button
              title={isCreateMode ? 'Create account' : 'Sign in'}
              size="lg"
              loading={isSubmitting}
              disabled={isGoogleSubmitting}
              onPress={() => void submit()}
            />
            <Button
              title={isCreateMode ? 'I already have an account' : 'Create a new account'}
              variant="ghost"
              disabled={isSubmitting || isGoogleSubmitting}
              onPress={toggleMode}
            />
          </View>

          <View style={styles.privacyNote}>
            <ThemedText variant="caption" tone="brand">PRIVATE BY DESIGN</ThemedText>
            <ThemedText variant="subhead" tone="secondary" selectable>No recordings. No public profile directory. Just focused calls.</ThemedText>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.systemBackground },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  shell: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.lg,
  },
  header: { gap: Spacing.lg, paddingHorizontal: Spacing.xs },
  intro: { gap: Spacing.sm },
  formCard: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.secondaryBackground,
    boxShadow: Shadows.card,
  },
  googleButton: { alignSelf: 'stretch' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator },
  field: { gap: Spacing.xs },
  input: {
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    color: Colors.label,
    backgroundColor: Colors.systemBackground,
    fontSize: 16,
  },
  errorBox: {
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.secondaryBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.destructive,
  },
  privacyNote: { gap: Spacing.xs, paddingHorizontal: Spacing.xs },
});
