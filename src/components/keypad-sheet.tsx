import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import {
  Colors,
  MaxContentWidth,
  Radius,
  Shadows,
  Spacing,
  useBrandColors,
  useThemeBackground,
} from '@/constants/theme';
import type { DemoPerson } from '@/features/contacts/demo-people';
import type { CallKind } from '@/features/calls/call-state';
import { normalizePhoneNumber } from '@/features/profile/profile-service';

const MAX_DIGITS = 20;

const KEYS: ReadonlyArray<{ value: string; letters?: string }> = [
  { value: '1' },
  { value: '2', letters: 'ABC' },
  { value: '3', letters: 'DEF' },
  { value: '4', letters: 'GHI' },
  { value: '5', letters: 'JKL' },
  { value: '6', letters: 'MNO' },
  { value: '7', letters: 'PQRS' },
  { value: '8', letters: 'TUV' },
  { value: '9', letters: 'WXYZ' },
  { value: '+' },
  { value: '0' },
  { value: '#' },
];

const KEY_ROWS = [KEYS.slice(0, 3), KEYS.slice(3, 6), KEYS.slice(6, 9), KEYS.slice(9, 12)];

function DialKey({ value, letters, onPress }: { value: string; letters?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Dial ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.dialKey, { opacity: pressed ? 0.62 : 1 }]}
    >
      <ThemedText variant="title" style={styles.dialValue}>{value}</ThemedText>
      {letters ? <ThemedText variant="caption" tone="secondary" style={styles.dialLetters}>{letters}</ThemedText> : null}
    </Pressable>
  );
}

export function KeypadSheet({
  visible,
  contacts,
  onClose,
  onStartCall,
}: {
  visible: boolean;
  contacts: DemoPerson[];
  onClose: () => void;
  onStartCall: (person: DemoPerson, kind: CallKind) => void;
}) {
  const brand = useBrandColors();
  const backgroundColor = useThemeBackground();
  const insets = useSafeAreaInsets();
  const [digits, setDigits] = useState('');
  const [lookupState, setLookupState] = useState<'idle' | 'not-found' | 'error'>('idle');
  const [lookupKind, setLookupKind] = useState<CallKind | null>(null);

  useEffect(() => {
    if (!visible) {
      setDigits('');
      setLookupState('idle');
      setLookupKind(null);
    }
  }, [visible]);

  const addDigit = (value: string) => {
    setDigits((current) => {
      if (current.length >= MAX_DIGITS || (value === '+' && current.length > 0) || (value === '+' && current.includes('+'))) {
        return current;
      }
      return current + value;
    });
    setLookupState('idle');
  };

  const removeDigit = () => {
    setDigits((current) => current.slice(0, -1));
    setLookupState('idle');
  };

  const clearDigits = () => {
    setDigits('');
    setLookupState('idle');
  };

  const lookup = async (kind: CallKind) => {
    const normalizedNumber = normalizePhoneNumber(digits);
    if (!normalizedNumber || normalizedNumber.replace(/^\+/, '').length === 0) {
      setLookupState('error');
      return;
    }

    setLookupKind(kind);
    try {
      const localPerson = contacts.find(
        (person) => person.phoneNumber && normalizePhoneNumber(person.phoneNumber) === normalizedNumber,
      );
      if (localPerson) {
        onStartCall(localPerson, kind);
        onClose();
        return;
      }
      setLookupState('not-found');
    } catch {
      setLookupState('error');
    } finally {
      setLookupKind(null);
    }
  };

  const closeButtonIcon: { ios: SFSymbol; android: AndroidSymbol } = { ios: 'xmark', android: 'close' };
  const backspaceIcon: { ios: SFSymbol; android: AndroidSymbol } = { ios: 'delete.left', android: 'backspace' };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay} accessibilityViewIsModal>
        <Pressable accessibilityRole="button" accessibilityLabel="Close keypad" onPress={onClose} style={styles.backdrop} />
        <View
          style={[
            styles.sheet,
            { backgroundColor, paddingBottom: Math.max(insets.bottom, Spacing.lg) },
          ]}
        >
          <View style={styles.grabber} />
          <View style={styles.sheetHeader}>
            <ThemedText variant="title">Keypad</ThemedText>
            <IconButton
              label="Close keypad"
              icon={<SymbolView name={closeButtonIcon} size={18} tintColor={Colors.label} />}
              onPress={onClose}
              style={styles.closeButton}
            />
          </View>

          <View style={styles.numberRow}>
            <ThemedText variant="title" style={styles.numberText} numberOfLines={1} adjustsFontSizeToFit>
              {digits || 'Enter a phone number'}
            </ThemedText>
            {digits ? (
              <IconButton
                label="Delete last digit"
                icon={<SymbolView name={backspaceIcon} size={22} tintColor={Colors.label} />}
                onPress={removeDigit}
                style={styles.backspaceButton}
              />
            ) : null}
          </View>

          {lookupState === 'error' ? (
            <ThemedText variant="subhead" tone="destructive" style={styles.statusText}>Enter a phone number to call.</ThemedText>
          ) : null}
          {lookupState === 'not-found' ? (
            <ThemedText variant="subhead" tone="secondary" style={styles.statusText}>
              That number isn’t in your saved Callnet contacts. Add the person from your phone contacts first.
            </ThemedText>
          ) : null}

          <View style={styles.dialGrid}>
            {KEY_ROWS.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.dialRow}>
                {row.map((key) => (
                  <DialKey key={key.value} value={key.value} letters={key.letters} onPress={() => addDigit(key.value)} />
                ))}
              </View>
            ))}
          </View>

          <View style={styles.callActions}>
            <Button
              title="Audio"
              variant="secondary"
              size="lg"
              disabled={lookupKind !== null}
              loading={lookupKind === 'voice'}
              onPress={() => void lookup('voice')}
              style={[styles.callAction, { borderColor: brand.accent }]}
            />
            <Button
              title="Video"
              size="lg"
              disabled={lookupKind !== null}
              loading={lookupKind === 'video'}
              onPress={() => void lookup('video')}
              style={styles.callAction}
            />
          </View>
          {digits ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear number"
              onPress={clearDigits}
              style={({ pressed }) => [styles.clearButton, { opacity: pressed ? 0.62 : 1 }]}
            >
              <ThemedText variant="caption" tone="secondary">Clear number</ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.42)' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    backgroundColor: Colors.systemBackground,
    boxShadow: Shadows.raised,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.separator,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 44, height: 44, paddingHorizontal: 0 },
  numberRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  numberText: { flex: 1, textAlign: 'center', fontVariant: ['tabular-nums'] },
  backspaceButton: { width: 48, height: 48, paddingHorizontal: 0 },
  statusText: { textAlign: 'center' },
  dialGrid: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: Spacing.sm },
  dialRow: { flexDirection: 'row', gap: Spacing.sm },
  dialKey: {
    flex: 1,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.secondaryBackground,
  },
  dialValue: { lineHeight: 26 },
  dialLetters: { minHeight: 16, letterSpacing: 1.4 },
  callActions: { flexDirection: 'row', gap: Spacing.sm },
  callAction: { flex: 1 },
  clearButton: { alignSelf: 'center', minHeight: 32, justifyContent: 'center', paddingHorizontal: Spacing.md },
});
