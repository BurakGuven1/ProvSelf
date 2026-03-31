import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { colors, typography, borderRadius } from '@/src/constants/theme';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  uri?: string | null;
  size?: AvatarSize;
  fallback?: string;
}

const sizeMap: Record<AvatarSize, number> = {
  sm: 32,
  md: 48,
  lg: 72,
};

const fontSizeMap: Record<AvatarSize, number> = {
  sm: 13,
  md: 18,
  lg: 28,
};

export default function Avatar({
  uri,
  size = 'md',
  fallback = '?',
}: AvatarProps) {
  const dimension = sizeMap[size];
  const containerStyle = {
    width: dimension,
    height: dimension,
    borderRadius: dimension / 2,
  };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, containerStyle]}
        accessibilityLabel="User avatar"
      />
    );
  }

  const initials = fallback.slice(0, 2).toUpperCase();

  return (
    <View
      style={[styles.fallback, containerStyle]}
      accessibilityLabel={`Avatar: ${initials}`}
    >
      <Text style={[styles.initials, { fontSize: fontSizeMap[size] }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
  },
  fallback: {
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
