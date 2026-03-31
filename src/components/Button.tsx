import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
  primary: {
    container: { backgroundColor: colors.primary },
    text: { color: colors.white },
  },
  secondary: {
    container: { backgroundColor: colors.backgroundSecondary },
    text: { color: colors.textPrimary },
  },
  outline: {
    container: {
      backgroundColor: colors.transparent,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
    },
    text: { color: colors.textPrimary },
  },
  danger: {
    container: { backgroundColor: colors.danger },
    text: { color: colors.white },
  },
  ghost: {
    container: { backgroundColor: colors.transparent },
    text: { color: colors.textPrimary },
  },
};

const sizeStyles: Record<ButtonSize, { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    text: { ...typography.subhead },
  },
  md: {
    container: { paddingVertical: spacing.md - 2, paddingHorizontal: spacing.lg },
    text: { ...typography.headline },
  },
  lg: {
    container: { paddingVertical: spacing.md + 2, paddingHorizontal: spacing.xl },
    text: { ...typography.headline, fontSize: 18 },
  },
};

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
}: ButtonProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variantStyles[variant].container,
        sizeStyles[size].container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
      ]}
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.7}
      accessibilityLabel={title}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyles[variant].text.color}
        />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text
            style={[
              styles.text,
              variantStyles[variant].text,
              sizeStyles[size].text,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: spacing.sm,
  },
  text: {
    fontWeight: '600',
  },
});
