import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { format, differenceInDays, eachDayOfInterval, parseISO, isSameDay, isAfter } from 'date-fns';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import { useChallengeStore } from '@/src/stores/challenge-store';
import { supabase } from '@/src/lib/supabase';
import ProgressBar from '@/src/components/ProgressBar';
import Card from '@/src/components/Card';
import Button from '@/src/components/Button';
import StakeAmount from '@/src/components/StakeAmount';
import Badge from '@/src/components/Badge';
import type { Challenge, DailyProof } from '@/src/types/database';

export default function ChallengeDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { fetchChallengeById } = useChallengeStore();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [proofs, setProofs] = useState<DailyProof[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading || !challenge) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const daysLeft = Math.max(0, differenceInDays(parseISO(challenge.end_date), new Date()));
  const progress = challenge.required_completions > 0
    ? challenge.completed_days / challenge.required_completions
    : 0;
  const isActive = challenge.status === 'active';
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const verifiedToday = proofs.some((p) => p.proof_date === todayStr && p.is_verified);

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

        {/* Verify Button */}
        {isActive && !verifiedToday && (
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
          </View>
        )}

        {isActive && verifiedToday && (
          <Card style={styles.verifiedCard}>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            <Text style={styles.verifiedText}>{t('home.verified_today')}</Text>
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
});
