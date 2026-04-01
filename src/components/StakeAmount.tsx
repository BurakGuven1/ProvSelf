import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '@/src/constants/theme';

type StakeSize = 'sm' | 'md' | 'lg';

interface StakeAmountProps {
  cents: number;
  size?: StakeSize;
  showSign?: boolean;
}

const sizeConfig = {
  sm: { dollar: typography.subhead, coin: 14 },
  md: { dollar: typography.title3, coin: 18 },
  lg: { dollar: typography.title1, coin: 24 },
} as const;

function formatCents(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  return dollars.toFixed(2);
}

export default function StakeAmount({
  cents,
  size = 'md',
  showSign = false,
}: StakeAmountProps) {
  const config = sizeConfig[size];
  const isNegative = cents < 0;
  const sign = showSign ? (isNegative ? '-' : '+') : isNegative ? '-' : '';
  const formatted = formatCents(cents);

  return (
    <View style={styles.container} accessibilityLabel={`${sign}$${formatted}`}>
      <Text style={[styles.coin, { fontSize: config.coin }]}>&#x25C9;</Text>
      <Text style={[styles.amount, config.dollar]}>
        {sign}${formatted}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coin: {
    color: colors.stakeGold,
    marginRight: spacing.xs,
  },
  amount: {
    color: colors.stakeGoldDark,
    fontWeight: '700',
  },
});
