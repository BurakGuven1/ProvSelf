import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import { supabase } from '@/src/lib/supabase';
import { useAuthStore } from '@/src/stores/auth-store';
import Avatar from '@/src/components/Avatar';
import EmptyState from '@/src/components/EmptyState';
import type { LeaderboardEntry } from '@/src/types/database';

interface BuddyPairRow {
  user_id: string;
  buddy_id: string;
}

const LEADERBOARD_FIELDS =
  'id, username, display_name, avatar_url, current_streak, longest_streak, total_wins, xp, level';

export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const { profile, fetchProfile } = useAuthStore();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'global' | 'friends'>('global');
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  const fetchGlobalLeaderboard = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(LEADERBOARD_FIELDS)
      .gt('total_challenges', 0)
      .order('xp', { ascending: false })
      .limit(100);
    if (error) throw error;

    return (data ?? []).map((d, i) => ({ ...d, global_rank: i + 1 } as LeaderboardEntry));
  }, []);

  const fetchFriendsLeaderboard = useCallback(async () => {
    if (!profile?.id) {
      return [];
    }

    const { data: pairs, error: pairsError } = await supabase
      .from('buddy_pairs')
      .select('user_id, buddy_id')
      .eq('status', 'active')
      .or(`user_id.eq.${profile.id},buddy_id.eq.${profile.id}`);
    if (pairsError) throw pairsError;

    const idSet = new Set<string>([profile.id]);
    (pairs ?? []).forEach((pair) => {
      const p = pair as BuddyPairRow;
      idSet.add(p.user_id === profile.id ? p.buddy_id : p.user_id);
    });

    const friendIds = Array.from(idSet);
    if (friendIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('profiles')
      .select(LEADERBOARD_FIELDS)
      .in('id', friendIds)
      .gt('total_challenges', 0)
      .order('xp', { ascending: false });
    if (error) throw error;

    return (data ?? []).map((d, i) => ({ ...d, global_rank: i + 1 } as LeaderboardEntry));
  }, [profile?.id]);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const leaderboard = tab === 'global'
        ? await fetchGlobalLeaderboard()
        : await fetchFriendsLeaderboard();
      setEntries(leaderboard);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [fetchFriendsLeaderboard, fetchGlobalLeaderboard, tab]);

  const handleInviteFriend = useCallback(async () => {
    const myProfile = profile;
    const username = inviteUsername.trim().toLowerCase();

    if (!myProfile?.id) {
      await fetchProfile();
      Alert.alert('Please wait', 'Your profile is still loading. Try again in a second.');
      return;
    }
    if (!username) return;
    if (username === myProfile.username.toLowerCase()) {
      Alert.alert('Invalid username', 'You cannot add yourself.');
      return;
    }

    setInviteLoading(true);
    try {
      const { data: buddy, error: buddyError } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('username', username)
        .maybeSingle();
      if (buddyError) throw buddyError;
      if (!buddy) {
        Alert.alert('User not found', 'No user with that username exists.');
        return;
      }

      const { data: existingPair, error: existingError } = await supabase
        .from('buddy_pairs')
        .select('id, status, user_id, buddy_id')
        .or(
          `and(user_id.eq.${myProfile.id},buddy_id.eq.${buddy.id}),and(user_id.eq.${buddy.id},buddy_id.eq.${myProfile.id})`,
        )
        .maybeSingle();
      if (existingError) throw existingError;

      if (existingPair?.status === 'active') {
        Alert.alert('Already friends', `You are already buddies with @${username}.`);
        return;
      }
      if (existingPair?.status === 'pending') {
        if (existingPair.user_id === myProfile.id) {
          Alert.alert('Invite already sent', `Your request to @${username} is pending.`);
          return;
        }

        const { error: acceptError } = await supabase
          .from('buddy_pairs')
          .update({ status: 'active' })
          .eq('id', existingPair.id);
        if (acceptError) throw acceptError;

        Alert.alert('Friend added', `You are now buddies with @${username}.`);
        setInviteUsername('');
        await fetchLeaderboard();
        return;
      }

      const { error: inviteError } = await supabase.from('buddy_pairs').insert({
        user_id: myProfile.id,
        buddy_id: buddy.id,
      });
      if (inviteError) throw inviteError;

      Alert.alert('Invite sent', `Buddy request sent to @${username}.`);
      setInviteUsername('');
      await fetchLeaderboard();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Error', message);
    } finally {
      setInviteLoading(false);
    }
  }, [fetchLeaderboard, fetchProfile, inviteUsername, profile]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useFocusEffect(
    useCallback(() => {
      fetchLeaderboard();
    }, [fetchLeaderboard]),
  );

  const renderItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const isCurrentUser = item.id === profile?.id;
    const rankDisplay = item.global_rank || index + 1;

    return (
      <View style={[styles.row, isCurrentUser && styles.rowHighlight]}>
        <View style={styles.rankContainer}>
          {rankDisplay <= 3 ? (
            <View
              style={[
                styles.medal,
                rankDisplay === 1 && styles.gold,
                rankDisplay === 2 && styles.silver,
                rankDisplay === 3 && styles.bronze,
              ]}
            >
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
            {t('profile.level', { level: item.level })} - {t('leaderboard.wins', { count: item.total_wins })}
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

      {tab === 'friends' && (
        <View style={styles.inviteSection}>
          <Text style={styles.inviteLabel}>Add friend by username</Text>
          <View style={styles.inviteRow}>
            <TextInput
              style={styles.inviteInput}
              value={inviteUsername}
              onChangeText={setInviteUsername}
              placeholder="@username"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.inviteButton, (inviteLoading || !inviteUsername.trim()) && styles.inviteButtonDisabled]}
              onPress={handleInviteFriend}
              disabled={inviteLoading || !inviteUsername.trim()}
            >
              <Text style={styles.inviteButtonText}>
                {inviteLoading ? '...' : 'Add'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchLeaderboard} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title={
                tab === 'friends'
                  ? t('leaderboard.no_friends_title')
                  : t('leaderboard.no_global_title')
              }
              message={
                tab === 'friends'
                  ? t('leaderboard.no_friends_message')
                  : t('leaderboard.no_global_message')
              }
            />
          ) : null
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
  inviteSection: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  inviteLabel: {
    ...typography.caption1,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inviteInput: {
    flex: 1,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    ...typography.body,
  },
  inviteButton: {
    marginLeft: spacing.sm,
    height: 44,
    minWidth: 72,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  inviteButtonDisabled: {
    opacity: 0.6,
  },
  inviteButtonText: {
    ...typography.subhead,
    color: colors.white,
    fontWeight: '700',
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

