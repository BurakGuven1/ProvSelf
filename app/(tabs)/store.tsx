import { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import { useStakeStore } from '@/src/stores/stake-store';
import Card from '@/src/components/Card';
import Button from '@/src/components/Button';
import StakeAmount from '@/src/components/StakeAmount';

function StoreStat({ label, value, valueColor }: { label: string; value: number; valueColor?: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

export default function StoreScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { balance, fetchBalance } = useStakeStore();

  const refresh = useCallback(() => {
    fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Store</Text>
          <Text style={styles.subtitle}>Manage your funds and buy more tokens.</Text>
        </View>

        <Card variant="elevated" style={styles.balanceCard}>
          <View style={styles.balanceTop}>
            <View>
              <Text style={styles.balanceLabel}>{t('stake.your_balance')}</Text>
              <StakeAmount cents={balance?.balance_cents ?? 0} size="lg" />
            </View>
            <Ionicons name="wallet" size={28} color={colors.stakeGoldDark} />
          </View>
          <View style={styles.actionsRow}>
            <Button
              title={t('stake.buy_credits')}
              onPress={() => router.push('/stake/purchase')}
              size="sm"
            />
            <Button
              title={t('stake.balance')}
              onPress={() => router.push('/stake/balance')}
              variant="outline"
              size="sm"
            />
          </View>
        </Card>

        <Card style={styles.statsCard}>
          <StoreStat label="Purchased" value={balance?.total_purchased_cents ?? 0} />
          <StoreStat label="Returned" value={balance?.total_returned_cents ?? 0} valueColor={colors.success} />
          <StoreStat label="Forfeited" value={balance?.total_forfeited_cents ?? 0} valueColor={colors.danger} />
        </Card>

        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.infoText}>Complete challenges to get your tokens back.</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="close-circle" size={18} color={colors.danger} />
            <Text style={styles.infoText}>Missed challenges forfeit your staked tokens.</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark" size={18} color={colors.accent} />
            <Text style={styles.infoText}>Purchases are processed securely by Apple.</Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingTop: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.largeTitle,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.subhead,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  balanceCard: {
    marginBottom: spacing.lg,
  },
  balanceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  balanceLabel: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  statsCard: {
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  statLabel: {
    ...typography.subhead,
    color: colors.textSecondary,
  },
  statValue: {
    ...typography.headline,
    color: colors.textPrimary,
  },
  infoCard: {
    backgroundColor: colors.backgroundSecondary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoText: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
});
