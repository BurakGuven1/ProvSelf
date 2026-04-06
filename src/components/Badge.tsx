import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';

type BadgeVariant = 'default' | 'success' | 'danger' | 'warning' | 'gold';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  default: { bg: colors.backgroundSecondary, text: colors.textPrimary },
  success: { bg: '#E8F9ED', text: '#1B7D32' },
  danger: { bg: '#FFEBEE', text: colors.danger },
  warning: { bg: '#FFF3E0', text: '#E65100' },
  gold: { bg: '#FFF8E1', text: colors.stakeGoldDark },
};

const sizeConfig: Record<BadgeSize, { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: { paddingVertical: 2, paddingHorizontal: spacing.sm },
    text: { ...typography.caption2, fontWeight: '600' },
  },
  md: {
    container: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm + 4 },
    text: { ...typography.caption1, fontWeight: '600' },
  },
};

export default function Badge({
  label,
  variant = 'default',
  size = 'sm',
}: BadgeProps) {
  const palette = variantColors[variant];
  const sizing = sizeConfig[size];

  return (
    <View
      style={[
        styles.base,
        sizing.container,
        { backgroundColor: palette.bg },
      ]}
      accessibilityLabel={label}
    >
      <Text style={[sizing.text, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
});
