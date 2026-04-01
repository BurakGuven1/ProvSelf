import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing } from '@/src/constants/theme';
import { useChallengeStore } from '@/src/stores/challenge-store';
import Button from '@/src/components/Button';
import StakeAmount from '@/src/components/StakeAmount';
import type { Challenge } from '@/src/types/database';

export default function ChallengeResultScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const { fetchChallengeById } = useChallengeStore();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const scaleAnim = useState(new Animated.Value(0))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (challengeId) {
      fetchChallengeById(challengeId).then((c) => {
        setChallenge(c);
        if (c?.status === 'completed_success') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      });
    }

    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [challengeId]);

  if (!challenge) return null;

  const isSuccess = challenge.status === 'completed_success';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: isSuccess ? '#E8F5E9' : '#FFEBEE' },
            ]}
          >
            <Ionicons
              name={isSuccess ? 'trophy' : 'close-circle'}
              size={64}
              color={isSuccess ? colors.success : colors.danger}
            />
          </View>
        </Animated.View>

        <Animated.View style={[styles.details, { opacity: fadeAnim }]}>
          <Text style={styles.resultTitle}>
            {isSuccess ? t('challenge.completed_success') : t('challenge.completed_fail')}
          </Text>
          <Text style={styles.challengeTitle}>{challenge.title}</Text>
          <Text style={styles.stats}>
            {challenge.completed_days}/{challenge.required_completions} days completed
          </Text>

          <View style={styles.stakeResult}>
            <StakeAmount cents={challenge.stake_cents} size="lg" />
            <Text
              style={[
                styles.stakeStatus,
                { color: isSuccess ? colors.success : colors.danger },
              ]}
            >
              {isSuccess ? t('challenge.stake_returned') : t('challenge.stake_forfeited')}
            </Text>
          </View>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        {isSuccess && (
          <>
            <Button
              title={t('share.share_achievement')}
              onPress={() =>
                router.push({
                  pathname: '/share/card',
                  params: { challengeId: challenge.id },
                })
              }
              size="lg"
              fullWidth
              icon={<Ionicons name="share-outline" size={20} color={colors.white} />}
            />
            <View style={{ height: spacing.md }} />
          </>
        )}
        <Button
          title={t('common.done')}
          onPress={() => router.replace('/(tabs)')}
          variant="outline"
          size="lg"
          fullWidth
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconContainer: {
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  details: {
    alignItems: 'center',
  },
  resultTitle: {
    ...typography.title1,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  challengeTitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  stats: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  stakeResult: {
    alignItems: 'center',
  },
  stakeStatus: {
    ...typography.headline,
    marginTop: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
