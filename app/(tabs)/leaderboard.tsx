import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import { supabase } from '@/src/lib/supabase';
import { useAuthStore } from '@/src/stores/auth-store';
import Avatar from '@/src/components/Avatar';
import type { LeaderboardEntry } from '@/src/types/database';

export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'global' | 'friends'>('global');

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, current_streak, longest_streak, total_wins, xp, level')
        .gt('total_challenges', 0)
        .order('xp', { ascending: false })
        .limit(100);

      if (!error && data) {
        setEntries(
          data.map((d, i) => ({ ...d, global_rank: i + 1 } as LeaderboardEntry))
        );
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const renderItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const isCurrentUser = item.id === profile?.id;
    const rankDisplay = index + 1;

    return (
      <View style={[styles.row, isCurrentUser && styles.rowHighlight]}>
        <View style={styles.rankContainer}>
          {rankDisplay <= 3 ? (
            <View style={[styles.medal, rankDisplay === 1 && styles.gold, rankDisplay === 2 && styles.silver, rankDisplay === 3 && styles.bronze]}>
              <Text style={styles.medalText}>{rankDisplay}</Text>
            </View>
          ) : (
            <Text style={styles.rankText}>{rankDisplay}</Text>
          )}
        </View>
        <Avatar
          uri={item.avatar_url}
          size="sm"
          fallback={item.username.slice(0, 2).toUpperCase()}
        />
        <View style={styles.info}>
          <Text style={styles.username} numberOfLines={1}>
            {item.display_name || item.username}
          </Text>
          <Text style={styles.meta}>
            {t('profile.level', { level: item.level })} · {t('leaderboard.wins', { count: item.total_wins })}
          </Text>
        </View>
        <View style={styles.statsCol}>
          <Text style={styles.xpText}>{item.xp.toLocaleString()} XP</Text>
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={12} color={colors.warning} />
            <Text style={styles.streakText}>{item.current_streak}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('leaderboard.title')}</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'global' && styles.tabActive]}
          onPress={() => setTab('global')}
        >
          <Text style={[styles.tabText, tab === 'global' && styles.tabTextActive]}>
            {t('leaderboard.global')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'friends' && styles.tabActive]}
          onPress={() => setTab('friends')}
        >
          <Text style={[styles.tabText, tab === 'friends' && styles.tabTextActive]}>
            {t('leaderboard.friends')}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchLeaderboard} />
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.largeTitle,
    color: colors.textPrimary,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  tabActive: {
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    ...typography.subhead,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.backgroundTertiary,
  },
  rowHighlight: {
    backgroundColor: colors.backgroundSecondary,
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderBottomWidth: 0,
  },
  rankContainer: {
    width: 36,
    alignItems: 'center',
    marginRight: spacing.md,
  },
  rankText: {
    ...typography.headline,
    color: colors.textSecondary,
  },
  medal: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gold: {
    backgroundColor: '#FFD60A',
  },
  silver: {
    backgroundColor: '#C0C0C0',
  },
  bronze: {
    backgroundColor: '#CD7F32',
  },
  medalText: {
    ...typography.footnote,
    fontWeight: '700',
    color: colors.white,
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
  },
  username: {
    ...typography.headline,
    color: colors.textPrimary,
  },
  meta: {
    ...typography.caption1,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statsCol: {
    alignItems: 'flex-end',
  },
  xpText: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  streakText: {
    ...typography.caption2,
    fontWeight: '600',
    color: colors.warning,
    marginLeft: 2,
  },
});
