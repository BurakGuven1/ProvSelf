import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';

interface TokenPenaltyBannerProps {
  compact?: boolean;
}

export default function TokenPenaltyBanner({ compact = false }: TokenPenaltyBannerProps) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Ionicons name="warning" size={compact ? 16 : 18} color={colors.warning} />
      <Text style={[styles.text, compact && styles.textCompact]}>
        Challenge dogrulamazsan tokenlarin azalir. Gunluk onaylarini atlama.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFF8E1',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#F1D99B',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  wrapCompact: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
  },
  text: {
    ...typography.footnote,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 18,
    fontWeight: '600',
  },
  textCompact: {
    lineHeight: 16,
    fontWeight: '500',
  },
});

