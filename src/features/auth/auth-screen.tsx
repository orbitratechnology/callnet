import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';

import { useAuth } from './auth-provider';
import { getAuthErrorMessage } from './auth-service';

export function AuthScreen() {
  const { signInWithEmail, createEmailAccount } = useAuth();
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        await createEmailAccount(email.trim(), password, displayName);
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

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.intro}>
            <ThemedText variant="largeTitle">Callnet</ThemedText>
            <ThemedText variant="title">Private calls, made simple.</ThemedText>
            <ThemedText variant="body" tone="secondary">
              Sign in to call people you know from any of your devices.
            </ThemedText>
          </View>

          {isCreateMode ? (
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Display name"
              placeholderTextColor={Colors.secondaryLabel}
              style={styles.input}
              autoCapitalize="words"
              returnKeyType="next"
            />
          ) : null}
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={Colors.secondaryLabel}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={Colors.secondaryLabel}
            style={styles.input}
            secureTextEntry
            textContentType={isCreateMode ? 'newPassword' : 'password'}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
          />

          {error ? <ThemedText variant="subhead" tone="destructive">{error}</ThemedText> : null}

          <Button
            title={isCreateMode ? 'Create account' : 'Sign in'}
            size="lg"
            loading={isSubmitting}
            onPress={() => void submit()}
          />
          <Button
            title={isCreateMode ? 'I already have an account' : 'Create a new account'}
            variant="ghost"
            disabled={isSubmitting}
            onPress={toggleMode}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.systemBackground },
  content: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },
  card: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.secondaryBackground,
  },
  intro: { gap: Spacing.sm, paddingBottom: Spacing.md },
  input: {
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
    borderRadius: Radius.md,
    color: Colors.label,
    backgroundColor: Colors.systemBackground,
    fontSize: 16,
  },
});
