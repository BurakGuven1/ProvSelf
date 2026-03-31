import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import { useStakeStore } from '@/src/stores/stake-store';
import Button from '@/src/components/Button';
import Card from '@/src/components/Card';
import StakeAmount from '@/src/components/StakeAmount';
import ScreenHeader from '@/src/components/ScreenHeader';

export default function BalanceScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { balance, fetchBalance } = useStakeStore();

  useEffect(() => {
    fetchBalance();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title={t('stake.balance')}
        showBack
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card variant="elevated" style={styles.balanceCard}>
          <Text style={styles.label}>{t('stake.your_balance')}</Text>
          <StakeAmount cents={balance?.balance_cents ?? 0} size="lg" />
          <View style={styles.statsRow}>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatLabel}>Purchased</Text>
              <Text style={styles.miniStatValue}>
                ${((balance?.total_purchased_cents ?? 0) / 100).toFixed(0)}
              </Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatLabel}>Returned</Text>
              <Text style={[styles.miniStatValue, { color: colors.success }]}>
                ${((balance?.total_returned_cents ?? 0) / 100).toFixed(0)}
              </Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatLabel}>Forfeited</Text>
              <Text style={[styles.miniStatValue, { color: colors.danger }]}>
                ${((balance?.total_forfeited_cents ?? 0) / 100).toFixed(0)}
              </Text>
            </View>
          </View>
        </Card>

        <Button
          title={t('stake.add_funds')}
          onPress={() => router.push('/stake/purchase')}
          size="lg"
          fullWidth
          icon={<Ionicons name="add-circle" size={20} color={colors.white} />}
        />
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
  balanceCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingVertical: spacing.xl,
  },
  label: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.backgroundTertiary,
  },
  miniStat: {
    alignItems: 'center',
  },
  miniStatLabel: {
    ...typography.caption1,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  miniStatValue: {
    ...typography.headline,
    color: colors.textPrimary,
  },
});
