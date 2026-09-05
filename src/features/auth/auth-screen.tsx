import { useState } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { GoogleSignInButton } from 'react-native-nitro-google-signin';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, MaxContentWidth, Radius, Shadows, Spacing, useBrandColors } from '@/constants/theme';
import { isValidUsername, normalizeUsername } from '@/features/profile/profile-service';
import { strings } from '@/localization/strings';

import { useAuth } from './auth-provider';
import { getAuthErrorMessage } from './auth-service';

function BrandMark() {
  const brand = useBrandColors();
  return (
    <View style={[styles.brandMark, { backgroundColor: brand.accentSoft }]}>
      <ThemedText variant="title" style={{ color: brand.accentContrast }}>C</ThemedText>
    </View>
  );
}

export function AuthScreen() {
  const { signInWithGoogle, signInWithEmail, createEmailAccount } = useAuth();
  const colorScheme = useColorScheme();
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError(strings.auth.errors.emailPassword);
      return;
    }
    if (isCreateMode && !displayName.trim()) {
      setError(strings.auth.errors.displayName);
      return;
    }
    if (isCreateMode && !isValidUsername(normalizeUsername(username))) {
      setError(strings.auth.errors.username);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      if (isCreateMode) {
        await createEmailAccount(email.trim(), password, displayName.trim(), normalizeUsername(username));
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
      style={styles.screen}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.shell}>
          <View style={styles.header}>
            <BrandMark />
            <View style={styles.intro}>
              <ThemedText variant="largeTitle">
                {isCreateMode ? strings.auth.createTitle : strings.auth.signInTitle}
              </ThemedText>
              <ThemedText variant="body" tone="secondary" selectable>
                {isCreateMode ? strings.auth.createCopy : strings.auth.signInCopy}
              </ThemedText>
            </View>
          </View>

          <View style={styles.formCard}>
            {process.env.EXPO_OS === 'web' ? (
              <Button
                title={strings.auth.google}
                variant="secondary"
                size="lg"
                loading={isGoogleSubmitting}
                disabled={isSubmitting}
                onPress={() => void signInGoogle()}
              />
            ) : (
              <GoogleSignInButton
                signInBehavior="none"
                colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}
                size="wide"
                contentAlignment="center"
                loading={isGoogleSubmitting}
                disabled={isSubmitting}
                accessibilityLabel={strings.auth.google}
                style={styles.googleButton}
                onPress={() => void signInGoogle()}
              />
            )}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <ThemedText variant="caption" tone="secondary">{strings.auth.emailDivider}</ThemedText>
              <View style={styles.dividerLine} />
            </View>

            {isCreateMode ? (
              <View style={styles.field}>
                <ThemedText variant="caption" tone="secondary">{strings.auth.displayNameLabel}</ThemedText>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder={strings.auth.displayNamePlaceholder}
                  placeholderTextColor={Colors.secondaryLabel}
                  style={styles.input}
                  accessibilityLabel={strings.auth.displayNameLabel}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            ) : null}
            {isCreateMode ? (
              <View style={styles.field}>
                <ThemedText variant="caption" tone="secondary">{strings.auth.usernameLabel}</ThemedText>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder={strings.auth.usernamePlaceholder}
                  placeholderTextColor={Colors.secondaryLabel}
                  style={styles.input}
                  accessibilityLabel={strings.auth.usernameLabel}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="username"
                  returnKeyType="next"
                />
                <ThemedText variant="caption" tone="secondary">{strings.auth.usernameHint}</ThemedText>
              </View>
            ) : null}
            <View style={styles.field}>
              <ThemedText variant="caption" tone="secondary">{strings.auth.emailLabel}</ThemedText>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={strings.auth.emailPlaceholder}
                placeholderTextColor={Colors.secondaryLabel}
                style={styles.input}
                accessibilityLabel={strings.auth.emailLabel}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="next"
              />
            </View>
            <View style={styles.field}>
              <ThemedText variant="caption" tone="secondary">{strings.auth.passwordLabel}</ThemedText>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={isCreateMode ? strings.auth.passwordPlaceholderCreate : strings.auth.passwordPlaceholderSignIn}
                placeholderTextColor={Colors.secondaryLabel}
                style={styles.input}
                accessibilityLabel={strings.auth.passwordLabel}
                secureTextEntry
                textContentType={isCreateMode ? 'newPassword' : 'password'}
                returnKeyType="done"
                onSubmitEditing={() => void submit()}
              />
            </View>

            {error ? (
              <View style={styles.errorBox} accessible accessibilityRole="alert">
                <ThemedText variant="caption" tone="destructive">{strings.auth.errorTitle}</ThemedText>
                <ThemedText variant="subhead" tone="destructive" selectable>{error}</ThemedText>
              </View>
            ) : null}

            <Button
              title={isCreateMode ? strings.auth.createAccount : strings.auth.signIn}
              size="lg"
              loading={isSubmitting}
              disabled={isGoogleSubmitting}
              onPress={() => void submit()}
            />
            <Button
              title={isCreateMode ? strings.auth.switchToSignIn : strings.auth.switchToCreate}
              variant="ghost"
              disabled={isSubmitting || isGoogleSubmitting}
              onPress={toggleMode}
            />
          </View>

          <View style={styles.privacyNote}>
            <ThemedText variant="caption" tone="brand">{strings.auth.privateByDesign}</ThemedText>
            <ThemedText variant="subhead" tone="secondary" selectable>{strings.auth.privacyCopy}</ThemedText>
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
  brandMark: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
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
