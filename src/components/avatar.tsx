import { Image } from 'expo-image';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, useBrandColors } from '@/constants/theme';

export type AvatarProps = {
  initials: string;
  photoURL?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  accessible?: boolean;
  accessibilityLabel?: string;
};

export function Avatar({ initials, photoURL, size = 'md', accessible = true, accessibilityLabel }: AvatarProps) {
  const brand = useBrandColors();
  const [imageFailed, setImageFailed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [photoURL]);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReduceMotion(enabled);
      }
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const showImage = Boolean(photoURL && !imageFailed);

  return (
    <View
      style={[styles.base, styles[size], { backgroundColor: brand.accentSoft }]}
      accessible={accessible}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? (showImage ? 'Profile picture' : `${initials} avatar`)}
    >
      {showImage ? (
        <Image
          source={{ uri: photoURL! }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={reduceMotion ? 0 : 150}
          accessible={false}
          accessibilityIgnoresInvertColors
          onError={() => setImageFailed(true)}
        />
      ) : (
        <ThemedText variant={size === 'lg' || size === 'xl' ? 'title' : 'headline'} style={{ color: brand.accentContrast }}>
          {initials.slice(0, 2).toUpperCase()}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: Radius.full },
  image: StyleSheet.absoluteFill,
  sm: { width: 40, height: 40 },
  md: { width: 52, height: 52 },
  lg: { width: 96, height: 96, padding: Spacing.sm },
  xl: { width: 112, height: 112, padding: Spacing.sm },
});
