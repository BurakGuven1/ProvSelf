import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing } from '@/src/constants/theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
}

export default function ScreenHeader({
  title,
  subtitle,
  rightAction,
  showBack = false,
  onBack,
}: ScreenHeaderProps) {
  return (
    <View style={styles.container}>
      {showBack && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
      )}
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {rightAction && <View style={styles.rightAction}>{rightAction}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backButton: {
    marginRight: spacing.xs,
    marginBottom: 2,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    ...typography.largeTitle,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.subhead,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rightAction: {
    marginLeft: spacing.sm,
    marginBottom: 4,
  },
});
