import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import { countVerifiedCompletions, getCompletionSlotKey } from '@/src/lib/challenge-progress';
import { supabase } from '@/src/lib/supabase';
import { initHealthKit, getMetricValue } from '@/src/lib/healthkit';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChallengeStore } from '@/src/stores/challenge-store';
import Button from '@/src/components/Button';
import Card from '@/src/components/Card';
import type { Challenge, HealthKitVerificationConfig } from '@/src/types/database';

export default function HealthKitVerifyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const { session } = useAuthStore();
  const { fetchChallengeById } = useChallengeStore();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [healthValue, setHealthValue] = useState<number | null>(null);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [healthKitError, setHealthKitError] = useState(false);

  useEffect(() => {
    loadChallenge();
  }, [challengeId]);

  const loadChallenge = async () => {
    if (!challengeId) return;
    const c = await fetchChallengeById(challengeId);
    setChallenge(c);

    const config = c?.verification_config as HealthKitVerificationConfig | null;
    const metric = config?.metric ?? 'steps';

    try {
      const initialized = await initHealthKit();
      if (!initialized) {
        setHealthKitError(true);
        setChecking(false);
        return;
      }

      const value = await getMetricValue(metric, new Date());
      setHealthValue(Math.round(value));
    } catch (err) {
      console.warn('HealthKit read error:', err);
      setHealthKitError(true);
    } finally {
      setChecking(false);
    }
  };

  const handleVerify = async () => {
    if (!challenge || !session?.user || healthValue === null) return;

    const config = challenge.verification_config as HealthKitVerificationConfig | null;
    const target = config?.target ?? 0;
    const isVerified = healthValue >= target;

    setSubmitting(true);
    try {
      if (challenge.frequency === 'weekly') {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const todaySlot = getCompletionSlotKey(challenge.frequency, challenge.start_date, todayStr);
        const { data: weeklyRows, error: weeklyError } = await supabase
          .from('daily_proofs')
          .select('proof_date, is_verified')
          .eq('challenge_id', challenge.id)
          .eq('is_verified', true);
        if (weeklyError) throw weeklyError;
        const alreadySubmitted = (weeklyRows ?? []).some((row) =>
          getCompletionSlotKey(challenge.frequency, challenge.start_date, row.proof_date) === todaySlot,
        );
        if (alreadySubmitted) {
          Alert.alert('Already verified this week', 'Weekly challenges accept one verification per week.');
          setSubmitting(false);
          return;
        }
      }

      const { error } = await supabase.from('daily_proofs').upsert(
        {
          challenge_id: challenge.id,
          user_id: session.user.id,
          proof_date: format(new Date(), 'yyyy-MM-dd'),
          verification_type: 'healthkit',
          proof_data: { [config?.metric ?? 'value']: healthValue },
          is_verified: isVerified,
        },
        { onConflict: 'challenge_id,proof_date' },
      );

      if (error) throw error;

      if (isVerified) {
        const { data: verifiedRows, error: readError } = await supabase
          .from('daily_proofs')
          .select('proof_date, is_verified')
          .eq('challenge_id', challenge.id)
          .eq('is_verified', true);
        if (readError) throw readError;

        const completedUnits = countVerifiedCompletions(challenge, verifiedRows ?? []);
        await supabase
          .from('challenges')
          .update({
            completed_days: completedUnits,
            updated_at: new Date().toISOString(),
          })
          .eq('id', challenge.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      router.back();
    } catch {
      Alert.alert(t('common.error'), t('common.retry'));
    } finally {
      setSubmitting(false);
    }
  };

  const config = challenge?.verification_config as HealthKitVerificationConfig | null;
  const target = config?.target ?? 0;
  const metric = config?.metric ?? 'steps';
  const isMetTarget = healthValue !== null && healthValue >= target;

  const metricLabel = metric === 'water_ml'
    ? 'water intake'
    : metric.replace('_', ' ');
  const valueDisplay = metric === 'water_ml'
    ? `${healthValue?.toLocaleString() ?? 0} ml`
    : `${healthValue?.toLocaleString() ?? 0}`;
  const targetDisplay = metric === 'water_ml'
    ? `${target.toLocaleString()} ml`
    : target.toLocaleString();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('verification.healthkit_auto')}</Text>
      </View>

      <View style={styles.content}>
        {checking ? (
          <View style={styles.loadingSection}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Reading Apple Health data...</Text>
          </View>
        ) : healthKitError ? (
          <View style={styles.loadingSection}>
            <Ionicons name="alert-circle" size={48} color={colors.warning} />
            <Text style={styles.errorText}>
              Could not access Apple Health. Please make sure HealthKit permissions are enabled in Settings.
            </Text>
          </View>
        ) : (
          <>
            <Card variant="elevated" style={styles.resultCard}>
              <View style={styles.metricRow}>
                <Ionicons
                  name={isMetTarget ? 'checkmark-circle' : 'close-circle'}
                  size={48}
                  color={isMetTarget ? colors.success : colors.danger}
                />
              </View>
              <Text style={styles.valueText}>
                {valueDisplay}
              </Text>
              <Text style={styles.metricLabel}>{metricLabel}</Text>
              <View style={styles.targetRow}>
                <Text style={styles.targetLabel}>Target: {targetDisplay}</Text>
              </View>
            </Card>

            <View style={styles.statusMessage}>
              {isMetTarget ? (
                <Text style={[styles.statusText, { color: colors.success }]}>
                  You met your target! Great job.
                </Text>
              ) : (
                <Text style={[styles.statusText, { color: colors.danger }]}>
                  You didn't reach your target today.
                </Text>
              )}
            </View>
          </>
        )}
      </View>

      <View style={styles.footer}>
        {!checking && !healthKitError && (
          <Button
            title={isMetTarget ? 'Submit Verification' : 'Log Result'}
            onPress={handleVerify}
            loading={submitting}
            size="lg"
            fullWidth
            variant={isMetTarget ? 'primary' : 'secondary'}
          />
        )}
        <View style={styles.spacer} />
        <Button
          title={t('common.cancel')}
          onPress={() => router.back()}
          variant="ghost"
          size="md"
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  loadingSection: {
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    textAlign: 'center',
    lineHeight: 24,
  },
  resultCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  metricRow: {
    marginBottom: spacing.md,
  },
  valueText: {
    ...typography.largeTitle,
    fontSize: 48,
    color: colors.textPrimary,
  },
  metricLabel: {
    ...typography.subhead,
    color: colors.textSecondary,
    textTransform: 'capitalize',
    marginTop: spacing.xs,
  },
  targetRow: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.backgroundTertiary,
  },
  targetLabel: {
    ...typography.footnote,
    color: colors.textSecondary,
  },
  statusMessage: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  statusText: {
    ...typography.headline,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  spacer: {
    height: spacing.sm,
  },
});
