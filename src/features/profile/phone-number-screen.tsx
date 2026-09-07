import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import PhoneInput, { type IPhoneInputRef } from 'rn-international-phone-number';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, MaxContentWidth, Radius, Shadows, Spacing, useThemeBackground } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-provider';

import {
  ensureUserProfile,
  getDefaultPhoneCountry,
  isValidPhoneNumber,
  normalizePhoneNumber,
} from './profile-service';

const DEFAULT_PHONE_COUNTRY = getDefaultPhoneCountry();

const phoneInputStyles = {
  container: {
    minHeight: 56,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
    borderRadius: Radius.md,
    backgroundColor: Colors.systemBackground,
  },
  flagContainer: {
    backgroundColor: Colors.systemBackground,
    borderTopLeftRadius: Radius.md,
    borderBottomLeftRadius: Radius.md,
  },
  flag: { color: Colors.label, fontSize: 22 },
  caret: { color: Colors.secondaryLabel },
  divider: { backgroundColor: Colors.separator },
  callingCode: { color: Colors.label, fontSize: 16 },
  input: { color: Colors.label, fontSize: 16 },
} as const;

export function PhoneNumberScreen({ onSaved }: { onSaved: () => void }) {
  const { user, signOut } = useAuth();
  const backgroundColor = useThemeBackground();
  const phoneInputRef = useRef<IPhoneInputRef>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savePhoneNumber = async () => {
    if (!user) {
      return;
    }

    const inputValue = phoneInputRef.current?.internationalPhoneNumber || phoneNumber;
    const normalized = normalizePhoneNumber(inputValue, DEFAULT_PHONE_COUNTRY);
    if (!isValid && !isValidPhoneNumber(normalized, DEFAULT_PHONE_COUNTRY)) {
      setError('Enter a valid phone number to continue.');
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await ensureUserProfile(user, normalized);
      onSaved();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : '';
      setError(
        message.includes('already linked')
          ? 'That phone number is already linked to another account.'
          : 'We couldn’t save your phone number. Check it and try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.shell}>
          <View style={styles.intro}>
            <ThemedText variant="largeTitle">Add your phone number</ThemedText>
            <ThemedText variant="body" tone="secondary" selectable>
              Your phone number is your Callnet identity. It helps you connect with people already in your phone contacts.
            </ThemedText>
          </View>

          <View style={styles.card}>
            <ThemedText variant="caption" tone="secondary">Phone number</ThemedText>
            <PhoneInput
              ref={phoneInputRef}
              theme="dark"
              defaultCountry={DEFAULT_PHONE_COUNTRY}
              value={phoneNumber}
              onChangePhoneNumber={(value) => {
                setPhoneNumber(value);
                setError(null);
              }}
              onValidationChange={(valid) => setIsValid(valid)}
              placeholderType="number"
              modalType="bottomSheet"
              phoneInputStyles={phoneInputStyles}
              accessibilityLabelPhoneInput="Phone number"
              accessibilityHintPhoneInput="Choose your country and enter your phone number"
              returnKeyType="done"
              autoComplete="tel"
              textContentType="telephoneNumber"
            />
            <ThemedText variant="caption" tone="secondary">
              Choose your country code so your number works wherever you call from.
            </ThemedText>

            {error ? (
              <View style={styles.errorBox} accessible accessibilityRole="alert">
                <ThemedText variant="subhead" tone="destructive" selectable>{error}</ThemedText>
              </View>
            ) : null}

            <Button
              title="Continue"
              size="lg"
              loading={isSaving}
              disabled={!phoneNumber.trim() || isSaving}
              onPress={() => void savePhoneNumber()}
            />
          </View>

          <Button title="Sign out" variant="ghost" disabled={isSaving} onPress={() => void signOut()} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.systemBackground },
  content: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },
  shell: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.lg,
  },
  intro: { gap: Spacing.sm },
  card: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.secondaryBackground,
    boxShadow: Shadows.card,
  },
  errorBox: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.systemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.destructive,
  },
});
