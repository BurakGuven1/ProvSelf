import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import { useAuthStore } from '@/src/stores/auth-store';
import { useStakeStore } from '@/src/stores/stake-store';
import Avatar from '@/src/components/Avatar';
import Card from '@/src/components/Card';
import Button from '@/src/components/Button';
import StakeAmount from '@/src/components/StakeAmount';
import { useEffect } from 'react';

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile, signOut, loading } = useAuthStore();
  const { balance, fetchBalance } = useStakeStore();

  useEffect(() => {
    fetchBalance();
  }, []);

  if (!profile) return null;

  const xpForNext = profile.level * 1000;
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

        <View style={styles.profileSection}>
          <Avatar
            uri={profile.avatar_url}
            size="lg"
            fallback={profile.username.slice(0, 2).toUpperCase()}
          />
          <Text style={styles.displayName}>
            {profile.display_name || profile.username}
          </Text>
          <Text style={styles.username}>@{profile.username}</Text>
          <View style={styles.levelBadge}>
            <Ionicons name="star" size={14} color={colors.stakeGoldDark} />
            <Text style={styles.levelText}>
              {t('profile.level', { level: profile.level })} · {profile.xp} XP
            </Text>
          </View>
          <View style={styles.xpBarBg}>
            <View style={[styles.xpBarFill, { width: `${xpProgress * 100}%` }]} />
          </View>
        </View>

        {/* Stake Balance */}
        <Card
          variant="elevated"
          onPress={() => router.push('/stake/balance')}
          style={styles.balanceCard}
        >
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceLabel}>{t('stake.your_balance')}</Text>
              <StakeAmount cents={balance?.balance_cents ?? 0} size="lg" />
            </View>
            <Button
              title={t('stake.add_funds')}
              onPress={() => router.push('/stake/purchase')}
              variant="primary"
              size="sm"
            />
          </View>
        </Card>

        {/* Stats Grid */}
        <Text style={styles.sectionTitle}>{t('profile.statistics')}</Text>
        <View style={styles.statsGrid}>
          <StatBox label={t('profile.challenges_won')} value={profile.total_wins} />
          <StatBox label={t('profile.challenges_lost')} value={profile.total_losses} />
          <StatBox label={t('profile.current_streak')} value={profile.current_streak} />
          <StatBox label={t('profile.longest_streak')} value={profile.longest_streak} />
          <StatBox
            label={t('profile.total_staked')}
            value={`$${(profile.total_staked_cents / 100).toFixed(0)}`}
          />
          <StatBox
            label={t('profile.total_saved')}
            value={`$${((profile.total_staked_cents - profile.total_lost_cents) / 100).toFixed(0)}`}
          />
        </View>

        {/* Badges */}
        <Text style={styles.sectionTitle}>{t('profile.badges')}</Text>
        <Card style={styles.badgesCard}>
          <Text style={styles.noBadges}>{t('profile.no_badges')}</Text>
        </Card>

        <View style={styles.signOutSection}>
          <Button
            title={t('auth.sign_out')}
            onPress={signOut}
            variant="ghost"
            loading={loading}
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
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.largeTitle,
    color: colors.textPrimary,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  displayName: {
    ...typography.title2,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  username: {
    ...typography.subhead,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  levelText: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.stakeGoldDark,
    marginLeft: spacing.xs,
  },
  xpBarBg: {
    width: 140,
    height: 4,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 2,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: colors.stakeGold,
    borderRadius: 2,
  },
  balanceCard: {
    marginBottom: spacing.lg,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
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
    width: '33.33%',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
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
    textAlign: 'center',
  },
  badgesCard: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  noBadges: {
    ...typography.subhead,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  signOutSection: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
});
