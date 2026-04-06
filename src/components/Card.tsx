import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { colors, spacing, borderRadius } from '@/src/constants/theme';

type CardVariant = 'default' | 'elevated';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: CardVariant;
}

export default function Card({
  children,
  style,
  onPress,
  variant = 'default',
}: CardProps) {
  const cardStyle = [
    styles.base,
    variant === 'elevated' && styles.elevated,
    variant === 'default' && styles.default,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  default: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  elevated: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
});
