import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import { useAuthStore } from '@/src/stores/auth-store';
import { useStakeStore } from '@/src/stores/stake-store';
import { useChallengeStore } from '@/src/stores/challenge-store';
import { useSubscriptionStore } from '@/src/stores/subscription-store';
import Avatar from '@/src/components/Avatar';
import Card from '@/src/components/Card';
import Button from '@/src/components/Button';
import StakeAmount from '@/src/components/StakeAmount';
import EmptyState from '@/src/components/EmptyState';
import type { Challenge } from '@/src/types/database';

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ChallengeStatus({ challenge }: { challenge: Challenge }) {
  const { t } = useTranslation();

  const statusLabel = challenge.status === 'active'
    ? t('profile.challenge_active')
    : challenge.status === 'completed_success'
      ? t('profile.challenge_won')
      : t('profile.challenge_failed');

  const statusStyle = challenge.status === 'active'
    ? styles.statusActive
    : challenge.status === 'completed_success'
      ? styles.statusWon
      : styles.statusFailed;

  return (
    <View style={[styles.statusPill, statusStyle]}>
      <Text style={styles.statusText}>{statusLabel}</Text>
    </View>
  );
}

function ChallengeItem({ challenge }: { challenge: Challenge }) {
  const router = useRouter();
  const { t } = useTranslation();

  const tokenText = challenge.status === 'completed_fail'
    ? `-${challenge.stake_cents} ${t('stake.credits')}`
    : challenge.status === 'completed_success'
      ? `+${challenge.stake_cents} ${t('profile.tokens_returned')}`
      : `${challenge.stake_cents} ${t('profile.tokens_at_stake')}`;

  return (
    <Card
      variant="elevated"
      style={styles.challengeCard}
      onPress={() => router.push(`/challenge/${challenge.id}`)}
    >
      <View style={styles.challengeHeaderRow}>
        <View style={styles.challengeTitleWrap}>
          <Text style={styles.challengeTitle} numberOfLines={1}>
            {challenge.title}
          </Text>
          <Text style={styles.challengeMeta}>
            {format(parseISO(challenge.start_date), 'MMM d')} - {format(parseISO(challenge.end_date), 'MMM d')}
          </Text>
        </View>
        <ChallengeStatus challenge={challenge} />
      </View>

      <View style={styles.challengeFooterRow}>
        <Text style={styles.challengeProgress}>
          {challenge.completed_days}/{challenge.required_completions} {t('profile.days_done')}
        </Text>
        <Text
          style={[
            styles.challengeTokens,
            challenge.status === 'completed_fail' && styles.challengeTokensLost,
            challenge.status === 'completed_success' && styles.challengeTokensReturned,
          ]}
        >
          {tokenText}
        </Text>
      </View>
    </Card>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    profile,
    signOut,
    loading,
    error,
    fetchProfile,
    updateProfile,
  } = useAuthStore();
  const { balance, fetchBalance } = useStakeStore();
  const { challenges, fetchChallenges, loading: challengesLoading } = useChallengeStore();
  const { isPro } = useSubscriptionStore();

  const [initializing, setInitializing] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const refreshData = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setInitializing(true);
    }

    try {
      await Promise.all([
        fetchProfile(),
        fetchBalance(),
        fetchChallenges(),
      ]);
    } finally {
      if (showLoader) {
        setInitializing(false);
      }
    }
  }, [fetchBalance, fetchChallenges, fetchProfile]);

  useEffect(() => {
    refreshData(true);
  }, [refreshData]);

  useFocusEffect(
    useCallback(() => {
      refreshData(false);
    }, [refreshData]),
  );

  useEffect(() => {
    if (!profile) return;
    setDisplayNameInput(profile.display_name ?? '');
    setUsernameInput(profile.username);
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!profile) return;

    const normalizedUsername = usernameInput.trim().toLowerCase();
    const normalizedDisplayName = displayNameInput.trim();

    if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) {
      Alert.alert('Invalid username', 'Username must be 3-24 chars and use letters, numbers, underscore.');
      return;
    }

    const usernameUnchanged = normalizedUsername === profile.username;
    const displayNameUnchanged = (normalizedDisplayName || null) === (profile.display_name || null);
    if (usernameUnchanged && displayNameUnchanged) {
      setEditingProfile(false);
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile({
        username: normalizedUsername,
        display_name: normalizedDisplayName || null,
      });
      setEditingProfile(false);
      Alert.alert('Saved', 'Profile updated successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('duplicate') || message.includes('unique')) {
        Alert.alert('Username unavailable', 'This username is already taken.');
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const activeChallenges = useMemo(
    () => challenges.filter((challenge) => challenge.status === 'active'),
    [challenges],
  );

  const pastChallenges = useMemo(
    () => [...challenges]
      .filter((challenge) => challenge.status !== 'active')
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [challenges],
  );

  const totalCommitted = useMemo(
    () => challenges.reduce((sum, challenge) => sum + challenge.stake_cents, 0),
    [challenges],
  );

  const totalReturned = useMemo(
    () => challenges
      .filter((challenge) => challenge.status === 'completed_success')
      .reduce((sum, challenge) => sum + challenge.stake_cents, 0),
    [challenges],
  );

  const totalLostFromFailedChallenges = useMemo(
    () => challenges
      .filter((challenge) => challenge.status === 'completed_fail')
      .reduce((sum, challenge) => sum + challenge.stake_cents, 0),
    [challenges],
  );

  if (!profile && (initializing || loading)) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <EmptyState
            title={t('common.error')}
            message={error || 'Profile could not be loaded.'}
            actionLabel={t('common.retry')}
            onAction={() => refreshData(true)}
          />
          <Button
            title={t('auth.sign_out')}
            onPress={signOut}
            variant="ghost"
          />
        </View>
      </SafeAreaView>
    );
  }

  const xpProgress = (profile.xp % 1000) / 1000;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('profile.title')}</Text>
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <Card variant="elevated" style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Avatar
              uri={profile.avatar_url}
              size="lg"
              fallback={profile.username.slice(0, 2).toUpperCase()}
            />
            <View style={styles.heroIdentity}>
              <Text style={styles.displayName} numberOfLines={1}>
                {profile.display_name || profile.username}
              </Text>
              <Text style={styles.username}>@{profile.username}</Text>
              <View style={styles.levelBadge}>
                <Ionicons name="star" size={14} color={colors.stakeGoldDark} />
                <Text style={styles.levelText}>
                  {t('profile.level', { level: profile.level })} - {profile.xp} XP
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.xpBarBg}>
            <View style={[styles.xpBarFill, { width: `${xpProgress * 100}%` }]} />
          </View>

          <View style={styles.balanceCardRow}>
            <View>
              <Text style={styles.balanceLabel}>{t('stake.your_balance')}</Text>
              <StakeAmount cents={balance?.balance_cents ?? 0} size="md" />
            </View>
            <Button
              title="Store"
              onPress={() => router.push('/store')}
              variant="primary"
              size="sm"
            />
          </View>

          <View style={styles.quickLinksRow}>
            <TouchableOpacity
              style={styles.quickLinkBtn}
              onPress={() => router.push('/buddy/requests')}
            >
              <Ionicons name="mail-unread-outline" size={15} color={colors.accent} />
              <Text style={styles.quickLinkText}>Buddy Requests</Text>
            </TouchableOpacity>

            {!isPro && (
              <TouchableOpacity
                style={[styles.quickLinkBtn, styles.quickLinkProBtn]}
                onPress={() => router.push('/settings/subscription')}
              >
                <Ionicons name="star" size={15} color={colors.stakeGoldDark} />
                <Text style={[styles.quickLinkText, styles.quickLinkProText]}>
                  {t('settings.upgrade_to_pro')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        <Card style={styles.profileEditorCard}>
          <View style={styles.profileEditorHeader}>
            <Text style={styles.profileEditorTitle}>Profile Details</Text>
            {!editingProfile ? (
              <TouchableOpacity onPress={() => setEditingProfile(true)}>
                <Ionicons name="create-outline" size={20} color={colors.accent} />
              </TouchableOpacity>
            ) : null}
          </View>

          {editingProfile ? (
            <>
              <Text style={styles.fieldLabel}>Display name</Text>
              <TextInput
                style={styles.fieldInput}
                value={displayNameInput}
                onChangeText={setDisplayNameInput}
                placeholder="Your name"
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={styles.fieldLabel}>Username</Text>
              <TextInput
                style={styles.fieldInput}
                value={usernameInput}
                onChangeText={setUsernameInput}
                placeholder="username"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.profileEditActions}>
                <Button
                  title="Cancel"
                  onPress={() => {
                    setEditingProfile(false);
                    setDisplayNameInput(profile.display_name ?? '');
                    setUsernameInput(profile.username);
                  }}
                  variant="outline"
                  size="sm"
                />
                <Button
                  title="Save"
                  onPress={handleSaveProfile}
                  loading={savingProfile}
                  size="sm"
                />
              </View>
            </>
          ) : (
            <View style={styles.profileInfoRows}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Username</Text>
                <Text style={styles.infoValue}>@{profile.username}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Display name</Text>
                <Text style={styles.infoValue}>{profile.display_name || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Settings</Text>
                <TouchableOpacity onPress={() => router.push('/settings')}>
                  <Text style={styles.settingsLink}>Open</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Card>

        <Text style={styles.sectionTitle}>{t('profile.statistics')}</Text>
        <View style={styles.statsGrid}>
          <StatBox label={t('profile.challenges_won')} value={profile.total_wins} />
          <StatBox label={t('profile.challenges_lost')} value={profile.total_losses} />
          <StatBox label={t('profile.current_streak')} value={profile.current_streak} />
          <StatBox label={t('profile.longest_streak')} value={profile.longest_streak} />
          <StatBox label={t('profile.total_staked')} value={totalCommitted} />
          <StatBox label={t('profile.total_saved')} value={totalReturned} />
          <StatBox label={t('profile.tokens_lost')} value={totalLostFromFailedChallenges} />
          <StatBox label={t('stake.your_balance')} value={balance?.balance_cents ?? 0} />
        </View>

        <Text style={styles.sectionTitle}>Funds Overview</Text>
        <Card style={styles.fundsCard}>
          <View style={styles.fundsRow}>
            <Text style={styles.fundsLabel}>Purchased</Text>
            <Text style={styles.fundsValue}>{balance?.total_purchased_cents ?? 0}</Text>
          </View>
          <View style={styles.fundsRow}>
            <Text style={styles.fundsLabel}>Returned</Text>
            <Text style={[styles.fundsValue, { color: colors.success }]}>{balance?.total_returned_cents ?? 0}</Text>
          </View>
          <View style={styles.fundsRow}>
            <Text style={styles.fundsLabel}>Forfeited</Text>
            <Text style={[styles.fundsValue, { color: colors.danger }]}>{balance?.total_forfeited_cents ?? 0}</Text>
          </View>
        </Card>

        <Text style={styles.sectionTitle}>{t('profile.current_challenges')}</Text>
        {activeChallenges.length > 0 ? (
          activeChallenges.map((challenge) => (
            <ChallengeItem key={challenge.id} challenge={challenge} />
          ))
        ) : (
          <EmptyState
            title={t('profile.no_current_challenges_title')}
            message={t('profile.no_current_challenges_message')}
          />
        )}

        <Text style={styles.sectionTitle}>{t('profile.past_challenges')}</Text>
        {pastChallenges.length > 0 ? (
          pastChallenges.map((challenge) => (
            <ChallengeItem key={challenge.id} challenge={challenge} />
          ))
        ) : (
          <EmptyState
            title={t('profile.no_past_challenges_title')}
            message={t('profile.no_past_challenges_message')}
          />
        )}

        <View style={styles.signOutSection}>
          <Button
            title={t('auth.sign_out')}
            onPress={signOut}
            variant="ghost"
            loading={loading || challengesLoading}
          />
        </View>
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.largeTitle,
    color: colors.textPrimary,
  },
  heroCard: {
    marginBottom: spacing.lg,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIdentity: {
    marginLeft: spacing.md,
    flex: 1,
  },
  displayName: {
    ...typography.title3,
    color: colors.textPrimary,
  },
  username: {
    ...typography.subhead,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  levelText: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.stakeGoldDark,
    marginLeft: spacing.xs,
  },
  xpBarBg: {
    height: 6,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 3,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: colors.stakeGold,
    borderRadius: 3,
  },
  balanceCardRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.backgroundTertiary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickLinksRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickLinkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
  },
  quickLinkProBtn: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#F1D99B',
  },
  quickLinkText: {
    ...typography.footnote,
    color: colors.accent,
    fontWeight: '700',
  },
  quickLinkProText: {
    color: colors.stakeGoldDark,
  },
  balanceLabel: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  profileEditorCard: {
    marginBottom: spacing.lg,
  },
  profileEditorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  profileEditorTitle: {
    ...typography.headline,
    color: colors.textPrimary,
  },
  fieldLabel: {
    ...typography.caption1,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  fieldInput: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    ...typography.body,
    color: colors.textPrimary,
  },
  profileEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  profileInfoRows: {
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  infoLabel: {
    ...typography.subhead,
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.subhead,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  settingsLink: {
    ...typography.subhead,
    color: colors.accent,
    fontWeight: '600',
  },
  sectionTitle: {
    ...typography.title3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
    marginBottom: spacing.lg,
  },
  statBox: {
    width: '25%',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    ...typography.title3,
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.caption2,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  fundsCard: {
    marginBottom: spacing.lg,
  },
  fundsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  fundsLabel: {
    ...typography.subhead,
    color: colors.textSecondary,
  },
  fundsValue: {
    ...typography.headline,
    color: colors.textPrimary,
  },
  challengeCard: {
    marginBottom: spacing.md,
  },
  challengeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  challengeTitleWrap: {
    flex: 1,
    marginRight: spacing.md,
  },
  challengeTitle: {
    ...typography.headline,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  challengeMeta: {
    ...typography.caption1,
    color: colors.textSecondary,
  },
  statusPill: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusActive: {
    backgroundColor: '#E3F2FD',
  },
  statusWon: {
    backgroundColor: '#E8F5E9',
  },
  statusFailed: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    ...typography.caption2,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  challengeFooterRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.backgroundTertiary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  challengeProgress: {
    ...typography.footnote,
    color: colors.textSecondary,
  },
  challengeTokens: {
    ...typography.footnote,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  challengeTokensLost: {
    color: colors.danger,
  },
  challengeTokensReturned: {
    color: colors.success,
  },
  signOutSection: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
});
