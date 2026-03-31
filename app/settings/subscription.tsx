import { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
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

export default function SubscriptionScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [purchasing, setPurchasing] = useState(false);

  const handleSubscribe = async () => {
    setPurchasing(true);
    try {
      // In production: RevenueCat subscription purchase
      await new Promise((resolve) => setTimeout(resolve, 1500));
      Alert.alert('Welcome to Pro!', 'Your subscription is now active.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert(t('common.error'), t('common.retry'));
    } finally {
      setPurchasing(false);
    }
  };

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
          <Card
            onPress={() => setSelectedPlan('monthly')}
            style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
          >
            <Text style={styles.planName}>Monthly</Text>
            <Text style={styles.planPrice}>$4.99/mo</Text>
          </Card>

          <Card
            onPress={() => setSelectedPlan('yearly')}
            style={[styles.planCard, selectedPlan === 'yearly' && styles.planCardSelected]}
          >
            <View style={styles.saveBadge}>
              <Text style={styles.saveText}>SAVE 33%</Text>
            </View>
            <Text style={styles.planName}>Yearly</Text>
            <Text style={styles.planPrice}>$39.99/yr</Text>
            <Text style={styles.planSub}>$3.33/mo</Text>
          </Card>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title={`Subscribe ${selectedPlan === 'monthly' ? '$4.99/mo' : '$39.99/yr'}`}
          onPress={handleSubscribe}
          loading={purchasing}
          size="lg"
          fullWidth
        />
        <Text style={styles.disclaimer}>
          Cancel anytime. Subscription auto-renews unless cancelled at least 24 hours before the end of the current period.
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
  features: {
    marginBottom: spacing.xl,
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
  disclaimer: {
    ...typography.caption1,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 16,
  },
});
