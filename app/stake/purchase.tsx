import { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import Button from '@/src/components/Button';
import Card from '@/src/components/Card';
import ScreenHeader from '@/src/components/ScreenHeader';

interface StakePack {
  id: string;
  productId: string;
  credits: number;
  price: string;
  popular?: boolean;
}

const STAKE_PACKS: StakePack[] = [
  { id: '1', productId: 'provself_stake_500', credits: 500, price: '$4.99' },
  { id: '2', productId: 'provself_stake_1000', credits: 1000, price: '$9.99', popular: true },
  { id: '3', productId: 'provself_stake_2000', credits: 2000, price: '$19.99' },
  { id: '4', productId: 'provself_stake_5000', credits: 5000, price: '$49.99' },
];

export default function PurchaseScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [selectedPack, setSelectedPack] = useState<string>('2');
  const [purchasing, setPurchasing] = useState(false);

  const handlePurchase = async () => {
    const pack = STAKE_PACKS.find((p) => p.id === selectedPack);
    if (!pack) return;

    setPurchasing(true);
    try {
      // In production, this would call RevenueCat:
      // const purchaseResult = await Purchases.purchaseProduct(pack.productId);
      // Then validate via Supabase Edge Function

      // Simulated purchase for development
      await new Promise((resolve) => setTimeout(resolve, 1500));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Purchase Successful', `${pack.credits} stake credits added to your balance!`, [
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
        title={t('stake.buy_credits')}
        showBack
        onBack={() => router.back()}
      />

      <View style={styles.content}>
        <Text style={styles.subtitle}>
          Stake credits are used to back your challenges. Succeed and get them back!
        </Text>

        <View style={styles.packs}>
          {STAKE_PACKS.map((pack) => (
            <Card
              key={pack.id}
              onPress={() => setSelectedPack(pack.id)}
              style={[
                styles.packCard,
                selectedPack === pack.id && styles.packCardSelected,
              ]}
            >
              {pack.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>POPULAR</Text>
                </View>
              )}
              <View style={styles.coinIcon}>
                <Ionicons name="wallet" size={24} color={colors.stakeGoldDark} />
              </View>
              <Text style={styles.packCredits}>{pack.credits}</Text>
              <Text style={styles.packCreditsLabel}>{t('stake.credits')}</Text>
              <Text style={styles.packPrice}>{pack.price}</Text>
            </Card>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title={`Purchase ${STAKE_PACKS.find((p) => p.id === selectedPack)?.price ?? ''}`}
          onPress={handlePurchase}
          loading={purchasing}
          size="lg"
          fullWidth
        />
        <Text style={styles.disclaimer}>
          Payments are processed securely through Apple. Credits are non-refundable but returned when you complete challenges.
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
  subtitle: {
    ...typography.subhead,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  packs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.md,
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
  popularBadge: {
    position: 'absolute',
    top: -1,
    right: -1,
    backgroundColor: colors.stakeGold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderBottomLeftRadius: borderRadius.sm,
    borderTopRightRadius: borderRadius.lg - 1,
  },
  popularText: {
    ...typography.caption2,
    fontWeight: '700',
    color: colors.primary,
  },
  coinIcon: {
    marginBottom: spacing.sm,
  },
  packCredits: {
    ...typography.title1,
    color: colors.textPrimary,
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
