import { SymbolView } from 'expo-symbols';
import { useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Colors, Radius, Shadows, Spacing, useBrandColors } from '@/constants/theme';

type SearchBarProps = Omit<ComponentProps<typeof TextInput>, 'style'> & {
  onClear?: () => void;
};

export function SearchBar({ onClear, value, onFocus, onBlur, ...props }: SearchBarProps) {
  const brand = useBrandColors();
  const [focused, setFocused] = useState(false);
  const hasValue = Boolean(value);

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: focused ? brand.accent : Colors.separator,
          boxShadow: focused ? Shadows.raised : Shadows.card,
        },
      ]}
    >
      <SymbolView
        name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
        size={20}
        tintColor={focused ? brand.accent : Colors.secondaryLabel}
      />
      <TextInput
        {...props}
        value={value}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        placeholderTextColor={props.placeholderTextColor ?? Colors.secondaryLabel as string}
        style={styles.input}
      />
      {hasValue && onClear ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
          onPress={onClear}
          style={({ pressed }) => [styles.clearButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={19} tintColor={Colors.secondaryLabel} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 54,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: Colors.secondaryBackground,
    boxShadow: Shadows.card,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    paddingVertical: 0,
    color: Colors.label as string,
    fontSize: 16,
  },
  clearButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
