import { Image, StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, useBrandColors } from '@/constants/theme';

export type AvatarProps = { initials: string; photoURL?: string | null; size?: 'sm' | 'md' | 'lg' };

export function Avatar({ initials, photoURL, size = 'md' }: AvatarProps) {
  const brand = useBrandColors();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [photoURL]);

  const showImage = Boolean(photoURL && !imageFailed);

  return (
    <View
      style={[styles.base, styles[size], { backgroundColor: brand.accentSoft }]}
      accessibilityLabel={showImage ? 'Profile picture' : `${initials} avatar`}
    >
      {showImage ? (
        <Image
          source={{ uri: photoURL! }}
          style={styles.image}
          accessibilityIgnoresInvertColors
          onError={() => setImageFailed(true)}
        />
      ) : (
        <ThemedText variant={size === 'lg' ? 'title' : 'headline'} style={{ color: brand.accentContrast }}>
          {initials.slice(0, 2).toUpperCase()}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: Radius.full },
  image: { width: '100%', height: '100%' },
  sm: { width: 40, height: 40 },
  md: { width: 52, height: 52 },
  lg: { width: 96, height: 96, padding: Spacing.sm },
});
