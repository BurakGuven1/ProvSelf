import { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { differenceInDays } from 'date-fns';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChallengeStore } from '@/src/stores/challenge-store';
import { useCoachStore } from '@/src/stores/coach-store';
import { useStakeStore } from '@/src/stores/stake-store';
import Card from '@/src/components/Card';
import ProgressBar from '@/src/components/ProgressBar';
import Button from '@/src/components/Button';
import EmptyState from '@/src/components/EmptyState';
import StakeAmount from '@/src/components/StakeAmount';
import type { Challenge } from '@/src/types/database';

function getGreeting(name: string, t: (key: string, opts?: Record<string, unknown>) => string) {
  const hour = new Date().getHours();
  if (hour < 12) return t('home.greeting', { name });
  if (hour < 18) return t('home.greeting_afternoon', { name });
  return t('home.greeting_evening', { name });
}

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const router = useRouter();
  const { t } = useTranslation();
  const daysLeft = differenceInDays(new Date(challenge.end_date), new Date());
  const progress = challenge.required_completions > 0
    ? challenge.completed_days / challenge.required_completions
    : 0;

  return (
    <Card
      variant="elevated"
      onPress={() => router.push(`/challenge/${challenge.id}`)}
      style={styles.challengeCard}
    >
      <View style={styles.challengeHeader}>
        <View style={styles.challengeInfo}>
          <Text style={styles.challengeTitle} numberOfLines={1}>
            {challenge.title}
          </Text>
          <Text style={styles.challengeMeta}>
            {t('challenge.day_x_of_y', {
              current: challenge.completed_days + challenge.failed_days,
              total: challenge.duration_days,
            })}
            {' · '}
            {t('home.days_left', { count: Math.max(0, daysLeft) })}
          </Text>
        </View>
        <StakeAmount cents={challenge.stake_cents} size="sm" />
      </View>
      <ProgressBar
        progress={Math.min(progress, 1)}
        color={progress >= 0.7 ? colors.success : colors.accent}
        height={6}
      />
    </Card>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile } = useAuthStore();
  const { challenges, fetchChallenges, loading: challengesLoading } = useChallengeStore();
  const { messages, fetchMessages } = useCoachStore();
  const { fetchBalance } = useStakeStore();

  const activeChallenges = challenges.filter((c) => c.status === 'active');
  const latestCoachMessage = messages.find((m) => !m.is_read);
  const displayName = profile?.display_name || profile?.username || 'there';

  const onRefresh = useCallback(() => {
    fetchChallenges();
    fetchMessages();
    fetchBalance();
  }, []);

  useEffect(() => {
    fetchChallenges();
    fetchMessages();
    fetchBalance();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchChallenges();
      fetchMessages();
      fetchBalance();
    }, [fetchChallenges, fetchMessages, fetchBalance]),
  );

  const renderHeader = () => (
    <View style={styles.headerSection}>
      <Text style={styles.greeting}>{getGreeting(displayName, t)}</Text>

      {latestCoachMessage && (
        <Card style={styles.coachCard}>
          <View style={styles.coachRow}>
            <View style={styles.coachIcon}>
              <Ionicons name="sparkles" size={20} color={colors.accent} />
            </View>
            <View style={styles.coachContent}>
              <Text style={styles.coachLabel}>{t('home.coach_says')}</Text>
              <Text style={styles.coachMessage} numberOfLines={2}>
                {latestCoachMessage.content}
              </Text>
            </View>
          </View>
        </Card>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('home.active_challenges')}</Text>
        <TouchableOpacity onPress={() => router.push('/challenge/create')}>
          <Ionicons name="add-circle" size={28} color={colors.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={activeChallenges}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChallengeCard challenge={item} />}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <EmptyState
            title={t('home.no_challenges')}
            message={t('home.no_challenges_cta')}
            actionLabel={t('home.start_challenge')}
            onAction={() => router.push('/challenge/create')}
          />
        }
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={challengesLoading} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  headerSection: {
    paddingTop: spacing.md,
  },
  greeting: {
    ...typography.largeTitle,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  coachCard: {
    backgroundColor: colors.backgroundSecondary,
    marginBottom: spacing.lg,
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  coachIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  coachContent: {
    flex: 1,
  },
  coachLabel: {
    ...typography.caption1,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  coachMessage: {
    ...typography.subhead,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  challengeCard: {
    marginBottom: spacing.md,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  challengeInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  challengeTitle: {
    ...typography.headline,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  challengeMeta: {
    ...typography.footnote,
    color: colors.textSecondary,
  },
});
