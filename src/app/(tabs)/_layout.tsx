import { Tabs, router } from 'expo-router';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { CallnetBrand } from '@/components/callnet-brand';
import { Colors, Radius, Spacing, useBrandColors } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-provider';
import { getInitials } from '@/features/contacts/demo-people';

function TabIcon({
  color,
  ios,
  android,
}: {
  color: ColorValue;
  ios: SFSymbol;
  android: AndroidSymbol;
}) {
  return <SymbolView name={{ ios, android, web: android }} size={28} tintColor={color} />;
}

function HeaderProfileButton({
  displayName,
  photoURL,
  onPress,
}: {
  displayName: string;
  photoURL?: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open profile"
      onPress={onPress}
      style={({ pressed }) => [styles.headerAvatarButton, { opacity: pressed ? 0.68 : 1 }]}
    >
      <Avatar initials={getInitials(displayName)} photoURL={photoURL} size="sm" accessible={false} />
    </Pressable>
  );
}

export default function TabsLayout() {
  const brand = useBrandColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const profileName = user?.displayName ?? user?.email ?? 'Callnet account';

  return (
    <Tabs
      screenOptions={{
        headerLeftContainerStyle: { paddingLeft: Spacing.md },
        headerRightContainerStyle: { paddingRight: Spacing.md },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: Colors.systemBackground },
        tabBarActiveTintColor: brand.accent,
        tabBarInactiveTintColor: Colors.secondaryLabel,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: false,
        tabBarItemStyle: { flex: 1 },
        tabBarStyle: {
          height: 64 + insets.bottom,
          paddingTop: 12,
          paddingBottom: insets.bottom + 8,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: Colors.separator,
          backgroundColor: Colors.secondaryBackground,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Calls',
          headerLeft: () => <CallnetBrand />,
          headerRight: () => (
            <HeaderProfileButton
              displayName={profileName}
              photoURL={user?.photoURL}
              onPress={() => router.push('/profile')}
            />
          ),
          tabBarAccessibilityLabel: 'Calls',
          tabBarIcon: ({ color }) => <TabIcon color={color} ios="phone.fill" android="call" />,
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Contacts',
          tabBarAccessibilityLabel: 'Contacts',
          tabBarIcon: ({ color }) => <TabIcon color={color} ios="person.2.fill" android="people" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerAvatarButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
});
