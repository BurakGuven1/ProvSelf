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
  purchaseProduct,
  isRevenueCatConfigured,
  type PurchasesPackage,
} from '@/src/lib/revenue-cat';
import { useSubscriptionStore } from '@/src/stores/subscription-store';
import ScreenHeader from '@/src/components/ScreenHeader';
import Card from '@/src/components/Card';
import Button from '@/src/components/Button';

const PRO_FEATURES = [
  'Unlimited active challenges',
  'Unlimited AI Coach messages',
  'Detailed statistics & graphs',
  'Exclusive badges',
  'PRO badge on share cards',
  'Unlimited buddies',
];

interface SubPlan {
  key: 'monthly' | 'yearly';
  identifier: string;
  label: string;
  price: string;
  pricePerMonth?: string;
  rcPackage?: PurchasesPackage;
}

// Fallback plans (Expo Go / RevenueCat unavailable)
const FALLBACK_PLANS: SubPlan[] = [
  { key: 'monthly', identifier: 'provself_pro_monthly', label: 'Monthly', price: '$4.99/mo' },
  { key: 'yearly', identifier: 'provself_pro_yearly', label: 'Yearly', price: '$39.99/yr', pricePerMonth: '$3.33/mo' },
];

const IDENTIFIER_META: Record<string, { key: 'monthly' | 'yearly'; label: string }> = {
  provself_pro_monthly: { key: 'monthly', label: 'Monthly' },
  provself_pro_yearly: { key: 'yearly', label: 'Yearly' },
};

function resolvePlanMeta(pkg: PurchasesPackage): { key: 'monthly' | 'yearly'; label: string } | null {
  const packageIdentifier = pkg.identifier?.toLowerCase();
  const productIdentifier = pkg.product.identifier?.toLowerCase();

  if (packageIdentifier && IDENTIFIER_META[packageIdentifier]) {
    return IDENTIFIER_META[packageIdentifier];
  }
  if (productIdentifier && IDENTIFIER_META[productIdentifier]) {
    return IDENTIFIER_META[productIdentifier];
  }

  const packageTypeRaw = (pkg as unknown as { packageType?: string }).packageType?.toUpperCase();
  if (packageTypeRaw === 'MONTHLY') {
    return { key: 'monthly', label: 'Monthly' };
  }
  if (packageTypeRaw === 'ANNUAL' || packageTypeRaw === 'YEARLY') {
    return { key: 'yearly', label: 'Yearly' };
  }

  return null;
}

function computeMonthlyPrice(yearlyPrice: number): string {
  return `$${(yearlyPrice / 12).toFixed(2)}/mo`;
}

export default function SubscriptionScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isPro, checkSubscription, restore } = useSubscriptionStore();
  const [plans, setPlans] = useState<SubPlan[]>(FALLBACK_PLANS);
  const [selectedKey, setSelectedKey] = useState<'monthly' | 'yearly'>('yearly');
  const [purchasing, setPurchasing] = useState(false);
  const [loadingOfferings, setLoadingOfferings] = useState(true);

  const selected = plans.find((p) => p.key === selectedKey);

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
          const realPlans: SubPlan[] = [];
          for (const pkg of offerings.current.availablePackages) {
            const meta = resolvePlanMeta(pkg);
            if (meta) {
              realPlans.push({
                key: meta.key,
                identifier: pkg.product.identifier,
                label: meta.label,
                price: meta.key === 'yearly'
                  ? `${pkg.product.priceString}/yr`
                  : `${pkg.product.priceString}/mo`,
                pricePerMonth: meta.key === 'yearly'
                  ? computeMonthlyPrice(pkg.product.price)
                  : undefined,
                rcPackage: pkg,
              });
            }
          }
          if (realPlans.length > 0) {
            setPlans(realPlans);
          }
        }
      } catch (err) {
        console.error('[Subscription] Failed to load offerings:', err);
      } finally {
        setLoadingOfferings(false);
      }
    })();
  }, []);

  const handleSubscribe = async () => {
    if (!selected) return;

    if (!isRevenueCatConfigured()) {
      Alert.alert(
        'Not Available',
        'Subscriptions are not available right now. Please update to the latest build and try again.',
      );
      return;
    }

    setPurchasing(true);
    try {
      if (selected.rcPackage) {
        await purchasePackage(selected.rcPackage);
      } else {
        // Offerings can fail to map by package identifier in some RC setups.
        // Fallback to direct product purchase by App Store product id.
        await purchaseProduct(selected.identifier);
      }
      await checkSubscription();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Welcome to Pro!', 'Your subscription is now active.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
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
      const restored = await restore();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (restored) {
        Alert.alert('Restored', 'Your Pro subscription has been restored.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('No Subscription Found', 'No active Pro subscription was found for this account.');
      }
    } catch {
      Alert.alert(t('common.error'), 'Could not restore purchases.');
    }
  };

  // Already Pro — show active subscription state
  if (isPro) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader
          title={t('settings.upgrade_to_pro')}
          showBack
          onBack={() => router.back()}
        />
        <View style={styles.proActiveContainer}>
          <View style={styles.proIconCircle}>
            <Ionicons name="star" size={40} color={colors.stakeGoldDark} />
          </View>
          <Text style={styles.proActiveTitle}>You're a Pro member!</Text>
          <Text style={styles.proActiveSubtitle}>
            You have access to all Pro features. Manage your subscription in your device's Settings app.
          </Text>
          <View style={[styles.features, { marginTop: spacing.xl }]}>
            {PRO_FEATURES.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title={t('settings.upgrade_to_pro')}
        showBack
        onBack={() => router.back()}
      />

      <View style={styles.content}>
        <View style={styles.features}>
          {PRO_FEATURES.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <View style={styles.plans}>
          {plans.map((plan) => (
            <Card
              key={plan.key}
              onPress={() => setSelectedKey(plan.key)}
              style={[styles.planCard, selectedKey === plan.key && styles.planCardSelected]}
            >
              {plan.key === 'yearly' && (
                <View style={styles.saveBadge}>
                  <Text style={styles.saveText}>SAVE 33%</Text>
                </View>
              )}
              <Text style={styles.planName}>{plan.label}</Text>
              <Text style={[
                styles.planPrice,
                selectedKey === plan.key && { color: colors.accent },
              ]}>{plan.price}</Text>
              {plan.pricePerMonth && (
                <Text style={styles.planSub}>{plan.pricePerMonth}</Text>
              )}
            </Card>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title={`Subscribe ${selected?.price ?? ''}`}
          onPress={handleSubscribe}
          loading={purchasing}
          disabled={loadingOfferings}
          size="lg"
          fullWidth
        />
        <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn}>
          <Text style={styles.restoreText}>Restore Purchases</Text>
        </TouchableOpacity>
        <Text style={styles.disclaimer}>
          Cancel anytime. Subscription auto-renews unless cancelled at least 24 hours before the end of the current period. Payment is charged to your Apple ID account.
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
  proActiveContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  proIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFDE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  proActiveTitle: {
    ...typography.title1,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  proActiveSubtitle: {
    ...typography.subhead,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  features: {
    marginBottom: spacing.xl,
    alignSelf: 'stretch',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  featureText: {
    ...typography.body,
    color: colors.textPrimary,
    marginLeft: spacing.md,
  },
  plans: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  planCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderWidth: 2,
    borderColor: colors.transparent,
  },
  planCardSelected: {
    borderColor: colors.accent,
  },
  saveBadge: {
    position: 'absolute',
    top: -1,
    right: -1,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderBottomLeftRadius: borderRadius.sm,
    borderTopRightRadius: borderRadius.lg - 1,
  },
  saveText: {
    ...typography.caption2,
    fontWeight: '700',
    color: colors.white,
  },
  planName: {
    ...typography.headline,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  planPrice: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  planSub: {
    ...typography.caption1,
    color: colors.textSecondary,
    marginTop: spacing.xs,
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
