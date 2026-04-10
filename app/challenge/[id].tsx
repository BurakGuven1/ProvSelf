import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { format, differenceInCalendarDays, eachDayOfInterval, parseISO, isSameDay, isAfter } from 'date-fns';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import { countVerifiedCompletions, getCompletionSlotKey } from '@/src/lib/challenge-progress';
import { useChallengeStore } from '@/src/stores/challenge-store';
import { useAuthStore } from '@/src/stores/auth-store';
import { getHydrationHealthConfig, getNoProofDayPenalty, isHydrationChallenge } from '@/src/lib/challenge-rules';
import { supabase } from '@/src/lib/supabase';
import ProgressBar from '@/src/components/ProgressBar';
import Card from '@/src/components/Card';
import Button from '@/src/components/Button';
import StakeAmount from '@/src/components/StakeAmount';
import Badge from '@/src/components/Badge';
import TokenPenaltyBanner from '@/src/components/TokenPenaltyBanner';
import type { Challenge, DailyProof } from '@/src/types/database';

export default function ChallengeDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuthStore();
  const { fetchChallengeById, updateChallenge } = useChallengeStore();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [proofs, setProofs] = useState<DailyProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const c = await fetchChallengeById(id);
      if (c) setChallenge(c);

      const { data } = await supabase
        .from('daily_proofs')
        .select('*')
        .eq('challenge_id', id)
        .order('proof_date', { ascending: true });
      if (data) setProofs(data as DailyProof[]);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const saveVerificationType = async (nextType: Challenge['verification_type']) => {
    if (!challenge || challenge.status !== 'active') return;

    const hydration = isHydrationChallenge(challenge.title, challenge.description);
    if (hydration && nextType === 'photo_ai') {
      Alert.alert(
        t('verification.hydration_healthkit_required', {
          defaultValue:
            'Hydration challenges are verified only with Apple Health. Photo proof is disabled.',
        }),
      );
      return;
    }

    // Respect the immutable verification policy snapshot taken at create
    // time. Without this guard a user could create a "no smoking" / low-
    // proof challenge as HealthKit and then flip it to photo_ai here,
    // bypassing the proof_class hard-block on the verify-photo path.
    const hardBlocked = challenge.verification_policy?.hard_block_methods ?? [];
    if (Array.isArray(hardBlocked) && hardBlocked.includes(nextType)) {
      Alert.alert(
        t('verification.low_proof_blocked_title', {
          defaultValue: 'Verification Method Blocked',
        }),
        t('verification.low_proof_blocked_message', {
          defaultValue:
            'This challenge requires a different verification method. Please choose the recommended option.',
        }),
      );
      return;
    }

    const nextConfig = nextType === 'healthkit'
      ? hydration
        ? getHydrationHealthConfig()
        : { metric: 'steps', target: 10000 }
      : { description: challenge.title };

    setActionLoading(true);
    try {
      await updateChallenge(challenge.id, {
        verification_type: nextType,
        verification_config: nextConfig,
      });
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert(t('common.error'), message);
    } finally {
      setActionLoading(false);
    }
  };

  const approveTodayWithoutProof = async () => {
    if (!challenge || challenge.status !== 'active') return;

    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const existingToday = proofs.find((p) => p.proof_date === todayStr);
    if (existingToday?.is_verified) {
      return;
    }
    if (challenge.frequency === 'weekly') {
      const todaySlot = getCompletionSlotKey(challenge.frequency, challenge.start_date, todayStr);
      const hasWeekProof = proofs.some((proof) => {
        if (!proof.is_verified) return false;
        return getCompletionSlotKey(challenge.frequency, challenge.start_date, proof.proof_date) === todaySlot;
      });
      if (hasWeekProof) {
        Alert.alert(
          'Already verified this week',
          'Weekly challenges accept one verification per week.',
        );
        return;
      }
    }

    const basePenalty = getNoProofDayPenalty(challenge.stake_cents, challenge.duration_days);
    const currentPenalty = challenge.manual_override_penalty_cents ?? 0;
    const remainingPenaltyCap = Math.max(0, challenge.stake_cents - currentPenalty);
    const penaltyCents = Math.min(basePenalty, remainingPenaltyCap);
    Alert.alert(
      t('verification.no_proof_confirm_title', {
        defaultValue: 'Approve Without Proof?',
      }),
      t('verification.no_proof_confirm_message', {
        defaultValue:
          penaltyCents > 0
            ? `Today will be marked as completed, but you lose ${penaltyCents} tokens from your final return.`
            : 'Today will be marked as completed. No additional penalty remains on this challenge.',
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.done'),
          onPress: async () => {
            setActionLoading(true);
            try {
              const { data: sessionData } = await supabase.auth.getSession();
              const userId = sessionData.session?.user?.id;
              if (!userId) throw new Error('Not authenticated');

              const { error: proofError } = await supabase
                .from('daily_proofs')
                .upsert(
                  {
                    challenge_id: challenge.id,
                    user_id: userId,
                    proof_date: todayStr,
                    verification_type: challenge.verification_type,
                    proof_data: {
                      manual_override: true,
                      penalty_cents: penaltyCents,
                      reason: 'no_proof_day_approval',
                    },
                    is_verified: true,
                    ai_verification_result: null,
                    ai_verification_reasoning: 'Manual no-proof approval with day penalty applied.',
                    photo_url: null,
                  },
                  { onConflict: 'challenge_id,proof_date' },
                );
              if (proofError) throw proofError;

              // Race-safe recompute of completed_days off the verified
              // daily_proofs count instead of incrementing the local
              // snapshot. Avoids double-counting if the same approval is
              // performed twice (multi-device, retry).
              const { data: verifiedRows, error: countError } = await supabase
                .from('daily_proofs')
                .select('proof_date, is_verified')
                .eq('challenge_id', challenge.id)
                .eq('is_verified', true);
              const fallbackCompleted = challenge.completed_days + (existingToday?.is_verified ? 0 : 1);
              const nextCompletedDays =
                !countError && verifiedRows
                  ? countVerifiedCompletions(challenge, verifiedRows)
                  : fallbackCompleted;

              const { error: challengeError } = await supabase
                .from('challenges')
                .update({
                  completed_days: nextCompletedDays,
                  manual_override_penalty_cents: currentPenalty + penaltyCents,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', challenge.id);
              if (challengeError) {
                const msg = (challengeError.message ?? '').toLowerCase();
                const missingPenaltyColumn =
                  challengeError.code === '42703' || msg.includes('manual_override_penalty_cents');

                if (!missingPenaltyColumn) {
                  throw challengeError;
                }

                // Backward compatibility: if migration 00005 isn't applied yet,
                // still mark the day verified without storing penalty bucket.
                const { error: legacyUpdateError } = await supabase
                  .from('challenges')
                  .update({
                    completed_days: nextCompletedDays,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', challenge.id);
                if (legacyUpdateError) throw legacyUpdateError;
              }

              await loadData();
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              Alert.alert(t('common.error'), message);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  if (loading || !challenge) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  // end_date is inclusive (last task day) → +1 so today counts as a day left.
  const daysLeft = Math.max(
    0,
    differenceInCalendarDays(parseISO(challenge.end_date), new Date()) + 1,
  );
  const progress = challenge.required_completions > 0
    ? challenge.completed_days / challenge.required_completions
    : 0;
  const isActive = challenge.status === 'active';
  const isOwner = session?.user?.id === challenge.user_id;
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const verifiedToday = proofs.some((p) => p.proof_date === todayStr && p.is_verified);
  const hydrationChallenge = isHydrationChallenge(challenge.title, challenge.description);
  const policyHardBlocked = challenge.verification_policy?.hard_block_methods ?? [];
  const photoMethodBlocked =
    hydrationChallenge ||
    (Array.isArray(policyHardBlocked) && policyHardBlocked.includes('photo_ai'));
  const healthkitMethodBlocked =
    Array.isArray(policyHardBlocked) && policyHardBlocked.includes('healthkit');
  const manualPenalty = challenge.manual_override_penalty_cents ?? 0;
  const potentialReturn = Math.max(0, challenge.stake_cents - manualPenalty);
  const noProofPenalty = Math.min(
    getNoProofDayPenalty(challenge.stake_cents, challenge.duration_days),
    Math.max(0, challenge.stake_cents - manualPenalty),
  );

  const calendarDays = eachDayOfInterval({
    start: parseISO(challenge.start_date),
    end: parseISO(challenge.end_date),
  });

  const getVerifyRoute = () => {
    if (challenge.verification_type === 'healthkit') {
      return '/challenge/verify/healthkit';
    }
    return '/challenge/verify/photo';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push({ pathname: '/share/card', params: { challengeId: challenge.id } })}>
          <Ionicons name="share-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{challenge.title}</Text>
          <View style={styles.badges}>
            <Badge
              label={challenge.status === 'active' ? 'Active' : challenge.status === 'completed_success' ? 'Won' : 'Failed'}
              variant={challenge.status === 'active' ? 'default' : challenge.status === 'completed_success' ? 'success' : 'danger'}
            />
            <Badge label={`${challenge.duration_days}d`} variant="default" />
          </View>
        </View>

        <TokenPenaltyBanner compact />

        {/* Progress Card */}
        <Card variant="elevated" style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>{t('challenge.progress')}</Text>
            <Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text>
          </View>
          <ProgressBar
            progress={Math.min(progress, 1)}
            color={progress >= 0.7 ? colors.success : colors.accent}
            height={8}
          />
          <View style={styles.progressStats}>
            <View style={styles.progressStat}>
              <Text style={styles.statValue}>{challenge.completed_days}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.progressStat}>
              <Text style={styles.statValue}>{challenge.failed_days}</Text>
              <Text style={styles.statLabel}>Missed</Text>
            </View>
            <View style={styles.progressStat}>
              <Text style={styles.statValue}>{daysLeft}</Text>
              <Text style={styles.statLabel}>Remaining</Text>
            </View>
          </View>
        </Card>

        {/* Credits */}
        <Card style={styles.stakeCard}>
          <View style={styles.stakeRow}>
            <View>
              <Text style={styles.stakeLabel}>Credits committed</Text>
              <StakeAmount cents={challenge.stake_cents} size="lg" />
              {manualPenalty > 0 && (
                <Text style={styles.penaltyHintText}>
                  Penalty applied: -{manualPenalty} tokens · potential return: {potentialReturn}
                </Text>
              )}
            </View>
            <View style={styles.stakeStatus}>
              {challenge.status === 'completed_success' ? (
                <Text style={[styles.stakeStatusText, { color: colors.success }]}>
                  {t('stake.stake_back')}
                </Text>
              ) : challenge.status === 'completed_fail' ? (
                <Text style={[styles.stakeStatusText, { color: colors.danger }]}>
                  {t('stake.stake_lost')}
                </Text>
              ) : (
                <Text style={styles.stakeStatusText}>In progress</Text>
              )}
            </View>
          </View>
        </Card>

        {/* Calendar */}
        <Text style={styles.sectionTitle}>Calendar</Text>
        <View style={styles.calendar}>
          {calendarDays.map((day) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const proof = proofs.find((p) => p.proof_date === dayStr);
            const isFuture = isAfter(day, today);
            const isToday = isSameDay(day, today);

            let bg: string = colors.backgroundSecondary;
            let textColor: string = colors.textSecondary;
            if (proof?.is_verified) {
              bg = colors.success;
              textColor = colors.white;
            } else if (!isFuture && !isToday && !proof) {
              bg = colors.danger + '33';
              textColor = colors.danger;
            }
            if (isToday) {
              textColor = colors.textPrimary;
            }

            return (
              <View
                key={dayStr}
                style={[
                  styles.calDay,
                  { backgroundColor: bg },
                  isToday && styles.calDayToday,
                ]}
              >
                <Text style={[styles.calDayText, { color: textColor }]}>
                  {format(day, 'd')}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Verification method can be changed even while challenge is active */}
        {isActive && isOwner && (
          <>
            <Text style={styles.sectionTitle}>
              {t('verification.change_method_title', { defaultValue: 'Verification Method' })}
            </Text>
            <View style={styles.methodSwitchRow}>
              <TouchableOpacity
                style={[
                  styles.methodChip,
                  challenge.verification_type === 'healthkit' && styles.methodChipActive,
                  healthkitMethodBlocked && styles.methodChipDisabled,
                ]}
                disabled={actionLoading || healthkitMethodBlocked}
                onPress={() => saveVerificationType('healthkit')}
              >
                <Ionicons
                  name="heart"
                  size={16}
                  color={challenge.verification_type === 'healthkit' ? colors.white : colors.success}
                />
                <Text
                  style={[
                    styles.methodChipText,
                    challenge.verification_type === 'healthkit' && styles.methodChipTextActive,
                  ]}
                >
                  {t('challenge.healthkit_option')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.methodChip,
                  challenge.verification_type === 'photo_ai' && styles.methodChipActive,
                  photoMethodBlocked && styles.methodChipDisabled,
                ]}
                disabled={actionLoading || photoMethodBlocked}
                onPress={() => saveVerificationType('photo_ai')}
              >
                <Ionicons
                  name="camera"
                  size={16}
                  color={challenge.verification_type === 'photo_ai' ? colors.white : colors.accent}
                />
                <Text
                  style={[
                    styles.methodChipText,
                    challenge.verification_type === 'photo_ai' && styles.methodChipTextActive,
                  ]}
                >
                  {t('challenge.photo_option')}
                </Text>
              </TouchableOpacity>
            </View>
            {hydrationChallenge && (
              <Text style={styles.methodRuleText}>
                {t('verification.hydration_healthkit_required', {
                  defaultValue:
                    'Hydration challenges are verified only with Apple Health. Photo proof is disabled.',
                })}
              </Text>
            )}
            {!hydrationChallenge && photoMethodBlocked && (
              <Text style={styles.methodRuleText}>
                {t('verification.low_proof_blocked_message', {
                  defaultValue:
                    'This challenge requires a different verification method. Please choose the recommended option.',
                })}
              </Text>
            )}
          </>
        )}

        {/* Verify Button */}
        {isActive && isOwner && !verifiedToday && (
          <View style={styles.verifySection}>
            <Button
              title={t('verification.submit_proof')}
              onPress={() =>
                router.push({
                  pathname: getVerifyRoute(),
                  params: { challengeId: challenge.id },
                })
              }
              size="lg"
              fullWidth
            />
            <View style={styles.noProofSpacer} />
            <Button
              title={t('verification.no_proof_button', {
                defaultValue:
                  noProofPenalty > 0
                    ? `Approve without proof (-${noProofPenalty} tokens)`
                    : 'Approve without proof',
              })}
              onPress={approveTodayWithoutProof}
              loading={actionLoading}
              size="md"
              fullWidth
              variant="outline"
            />
          </View>
        )}

        {isActive && isOwner && verifiedToday && (
          <Card style={styles.verifiedCard}>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            <Text style={styles.verifiedText}>{t('home.verified_today')}</Text>
          </Card>
        )}

        {isActive && !isOwner && (
          <Card style={styles.watchOnlyCard}>
            <Ionicons name="eye-outline" size={20} color={colors.accent} />
            <Text style={styles.watchOnlyText}>
              Partner progress view only. Verification actions are available to the challenge owner.
            </Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  navBtn: {
    padding: spacing.xs,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.title1,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  progressCard: {
    marginBottom: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  progressLabel: {
    ...typography.headline,
    color: colors.textPrimary,
  },
  progressPercent: {
    ...typography.headline,
    color: colors.accent,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.lg,
  },
  progressStat: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.caption1,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  stakeCard: {
    marginBottom: spacing.lg,
    backgroundColor: '#FFFDE7',
  },
  stakeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stakeLabel: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  penaltyHintText: {
    ...typography.caption1,
    color: colors.warning,
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  stakeStatus: {},
  stakeStatusText: {
    ...typography.subhead,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sectionTitle: {
    ...typography.title3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  calendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.lg,
  },
  methodSwitchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  methodChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.backgroundTertiary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.backgroundSecondary,
  },
  methodChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  methodChipDisabled: {
    opacity: 0.45,
  },
  methodChipText: {
    ...typography.footnote,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  methodChipTextActive: {
    color: colors.white,
  },
  methodRuleText: {
    ...typography.caption1,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 17,
  },
  calDay: {
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calDayToday: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  calDayText: {
    ...typography.footnote,
    fontWeight: '600',
  },
  verifySection: {
    marginTop: spacing.md,
  },
  noProofSpacer: {
    height: spacing.sm,
  },
  verifiedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    marginTop: spacing.md,
  },
  verifiedText: {
    ...typography.headline,
    color: colors.success,
    marginLeft: spacing.sm,
  },
  watchOnlyCard: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#E8F1FF',
  },
  watchOnlyText: {
    ...typography.footnote,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 18,
  },
});
