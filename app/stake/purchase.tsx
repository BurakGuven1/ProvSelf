import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  isRevenueCatConfigured,
  type PurchasesPackage,
} from '@/src/lib/revenue-cat';
import { useStakeStore } from '@/src/stores/stake-store';
import Button from '@/src/components/Button';
import Card from '@/src/components/Card';
import ScreenHeader from '@/src/components/ScreenHeader';

interface StakePack {
  id: string;
  identifier: string;
  credits: number;
  price: string;
  popular?: boolean;
  bestValue?: boolean;
  rcPackage?: PurchasesPackage;
}

// Fallback packs (used when RevenueCat is unavailable, e.g. Expo Go)
const FALLBACK_PACKS: StakePack[] = [
  { id: '1', identifier: 'stake_500', credits: 500, price: '$4.99' },
  { id: '2', identifier: 'stake_1000', credits: 1000, price: '$9.99', popular: true },
  { id: '3', identifier: 'stake_2000', credits: 2000, price: '$17.99' },
  { id: '4', identifier: 'stake_5000', credits: 5000, price: '$39.99', bestValue: true },
];

const IDENTIFIER_CREDITS: Record<string, { credits: number; popular?: boolean; bestValue?: boolean }> = {
  stake_500: { credits: 500 },
  stake_1000: { credits: 1000, popular: true },
  stake_2000: { credits: 2000 },
  stake_5000: { credits: 5000, bestValue: true },
};

export default function PurchaseScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { balance, fetchBalance } = useStakeStore();
  const [packs, setPacks] = useState<StakePack[]>(FALLBACK_PACKS);
  const [selectedId, setSelectedId] = useState<string>('2');
  const [purchasing, setPurchasing] = useState(false);
  const [loadingOfferings, setLoadingOfferings] = useState(true);

  const currentBalance = balance?.balance_cents ?? 0;
  const selected = packs.find((p) => p.id === selectedId);

  // Load real offerings from RevenueCat
  useEffect(() => {
    (async () => {
      if (!isRevenueCatConfigured()) {
        setLoadingOfferings(false);
        return;
      }
      try {
        const offerings = await getOfferings();
        if (offerings?.current?.availablePackages) {
          const realPacks: StakePack[] = [];
          let idx = 0;
          for (const pkg of offerings.current.availablePackages) {
            const meta = IDENTIFIER_CREDITS[pkg.identifier];
            if (meta) {
              idx++;
              realPacks.push({
                id: String(idx),
                identifier: pkg.identifier,
                credits: meta.credits,
                price: pkg.product.priceString,
                popular: meta.popular,
                bestValue: meta.bestValue,
                rcPackage: pkg,
              });
            }
          }
          if (realPacks.length > 0) {
            setPacks(realPacks);
            // Select the popular one by default
            const popularPack = realPacks.find((p) => p.popular);
            if (popularPack) setSelectedId(popularPack.id);
          }
        }
      } catch (err) {
        console.error('[Purchase] Failed to load offerings:', err);
      } finally {
        setLoadingOfferings(false);
      }
    })();
  }, []);

  const handlePurchase = async () => {
    if (!selected) return;

    // If no RevenueCat package, purchase is unavailable
    if (!selected.rcPackage) {
      Alert.alert('Not Available', 'In-app purchases require an EAS development build. This feature is not available in Expo Go.');
      return;
    }

    setPurchasing(true);
    try {
      await purchasePackage(selected.rcPackage);
      // Purchase succeeded — webhook will credit balance server-side
      // Refresh balance (may take a moment for webhook to process)
      await new Promise((r) => setTimeout(r, 1500));
      await fetchBalance();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Purchase Successful',
        `${selected.credits} tokens added to your balance!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err: unknown) {
      if ((err as { userCancelled?: boolean }).userCancelled) return;
      const message = err instanceof Error ? err.message : 'Purchase failed';
      Alert.alert(t('common.error'), message);
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      await restorePurchases();
      await fetchBalance();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Restored', 'Your purchases have been restored.');
    } catch {
      Alert.alert(t('common.error'), 'Could not restore purchases.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title={t('stake.buy_credits')}
        showBack
        onBack={() => router.back()}
      />

      <View style={styles.content}>
        {/* Current balance */}
        <View style={styles.currentBalance}>
          <Ionicons name="wallet" size={20} color={colors.stakeGoldDark} />
          <Text style={styles.currentBalanceText}>
            Current balance: <Text style={styles.currentBalanceBold}>{currentBalance} tokens</Text>
          </Text>
        </View>

        <Text style={styles.subtitle}>
          {t('stake.buy_credits_description')}
        </Text>

        <View style={styles.packs}>
          {packs.map((pack) => (
            <Card
              key={pack.id}
              onPress={() => setSelectedId(pack.id)}
              style={[
                styles.packCard,
                selectedId === pack.id && styles.packCardSelected,
              ]}
            >
              {pack.popular && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>POPULAR</Text>
                </View>
              )}
              {pack.bestValue && (
                <View style={[styles.badge, styles.bestValueBadge]}>
                  <Text style={styles.badgeText}>BEST VALUE</Text>
                </View>
              )}
              <Ionicons
                name="wallet"
                size={24}
                color={selectedId === pack.id ? colors.stakeGoldDark : colors.textTertiary}
              />
              <Text style={[
                styles.packCredits,
                selectedId === pack.id && { color: colors.stakeGoldDark },
              ]}>{pack.credits}</Text>
              <Text style={styles.packCreditsLabel}>{t('stake.credits')}</Text>
              <Text style={[
                styles.packPrice,
                selectedId === pack.id && { color: colors.primary },
              ]}>{pack.price}</Text>
            </Card>
          ))}
        </View>

        {/* Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark" size={18} color={colors.success} />
            <Text style={styles.infoText}>Tokens returned when you complete challenges</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="lock-closed" size={18} color={colors.accent} />
            <Text style={styles.infoText}>Secure payment through Apple</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle" size={18} color={colors.textTertiary} />
            <Text style={styles.infoText}>Tokens are non-refundable and cannot be cashed out</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title={`Purchase for ${selected?.price ?? ''}`}
          onPress={handlePurchase}
          loading={purchasing}
          disabled={loadingOfferings}
          size="lg"
          fullWidth
        />
        <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn}>
          <Text style={styles.restoreText}>Restore Purchases</Text>
        </TouchableOpacity>
        <Text style={styles.disclaimer}>
          Payments are processed securely. Tokens are non-refundable, non-transferable, and cannot be redeemed for cash.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  currentBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDE7',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  currentBalanceText: {
    ...typography.subhead,
    color: colors.textSecondary,
  },
  currentBalanceBold: {
    fontWeight: '700',
    color: colors.stakeGoldDark,
  },
  subtitle: {
    ...typography.subhead,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  packs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  packCard: {
    width: '47%',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderWidth: 2,
    borderColor: colors.transparent,
  },
  packCardSelected: {
    borderColor: colors.stakeGold,
    backgroundColor: '#FFFDE7',
  },
  badge: {
    position: 'absolute',
    top: -1,
    right: -1,
    backgroundColor: colors.stakeGold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderBottomLeftRadius: borderRadius.sm,
    borderTopRightRadius: borderRadius.lg - 1,
  },
  bestValueBadge: {
    backgroundColor: colors.success,
  },
  badgeText: {
    ...typography.caption2,
    fontWeight: '700',
    color: colors.white,
  },
  packCredits: {
    ...typography.title1,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  packCreditsLabel: {
    ...typography.caption1,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  packPrice: {
    ...typography.headline,
    color: colors.accent,
  },
  infoSection: {
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoText: {
    ...typography.footnote,
    color: colors.textSecondary,
    flex: 1,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  restoreText: {
    ...typography.subhead,
    color: colors.accent,
    fontWeight: '500',
  },
  disclaimer: {
    ...typography.caption1,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
  },
});
