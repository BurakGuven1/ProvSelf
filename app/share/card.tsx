import { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import { useChallengeStore } from '@/src/stores/challenge-store';
import { useAuthStore } from '@/src/stores/auth-store';
import ProgressBar from '@/src/components/ProgressBar';
import Button from '@/src/components/Button';
import type { Challenge } from '@/src/types/database';

export default function ShareCardScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const { fetchChallengeById } = useChallengeStore();
  const { profile } = useAuthStore();
  const viewShotRef = useRef<ViewShot>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);

  useEffect(() => {
    if (challengeId) {
      fetchChallengeById(challengeId).then(setChallenge);
    }
  }, [challengeId]);

  const handleShare = async () => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) return;

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
      } else {
        Alert.alert('Sharing not available on this device.');
      }
    } catch {
      Alert.alert(t('common.error'), t('common.retry'));
    }
  };

  if (!challenge) return null;

  const progress = challenge.required_completions > 0
    ? challenge.completed_days / challenge.required_completions
    : 0;
  const stakeDollars = (challenge.stake_cents / 100).toFixed(0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('share.share_achievement')}</Text>
        <Button title={t('common.done')} onPress={() => router.back()} variant="ghost" size="sm" />
      </View>

      <View style={styles.cardWrapper}>
        <ViewShot
          ref={viewShotRef}
          options={{ format: 'png', quality: 1.0, result: 'tmpfile' }}
        >
          <View style={styles.shareCard}>
            <Text style={styles.cardLogo}>PROVSELF</Text>

            <View style={styles.cardMain}>
              <Ionicons name="trophy" size={32} color={colors.stakeGold} />
              <Text style={styles.cardStreak}>
                {challenge.completed_days}-DAY STREAK
              </Text>
            </View>

            <Text style={styles.cardChallenge}>{challenge.title}</Text>

            <View style={styles.cardProgress}>
              <ProgressBar
                progress={Math.min(progress, 1)}
                color={colors.success}
                height={8}
                showLabel
              />
            </View>

            <Text style={styles.cardStake}>
              ${stakeDollars} staked · ${stakeDollars} saved
            </Text>

            <View style={styles.cardFooter}>
              <Text style={styles.cardUsername}>
                @{profile?.username ?? 'user'}
              </Text>
              <Text style={styles.cardUrl}>provself.app</Text>
            </View>
          </View>
        </ViewShot>
      </View>

      <View style={styles.actions}>
        <Button
          title={t('share.share_to_instagram')}
          onPress={handleShare}
          size="lg"
          fullWidth
          icon={<Ionicons name="share-outline" size={20} color={colors.white} />}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    ...typography.title3,
    color: colors.textPrimary,
  },
  cardWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  shareCard: {
    width: 320,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.backgroundSecondary,
  },
  cardLogo: {
    ...typography.caption2,
    fontWeight: '700',
    letterSpacing: 4,
    color: colors.secondary,
    marginBottom: spacing.xl,
  },
  cardMain: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  cardStreak: {
    ...typography.title1,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  cardChallenge: {
    ...typography.headline,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  cardProgress: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  cardStake: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.stakeGoldDark,
    marginBottom: spacing.xl,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.backgroundTertiary,
  },
  cardUsername: {
    ...typography.footnote,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  cardUrl: {
    ...typography.footnote,
    color: colors.textTertiary,
  },
  actions: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
