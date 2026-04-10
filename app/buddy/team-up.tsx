import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import { supabase } from '@/src/lib/supabase';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChallengeStore } from '@/src/stores/challenge-store';
import { useStakeStore } from '@/src/stores/stake-store';
import Avatar from '@/src/components/Avatar';
import Card from '@/src/components/Card';
import Button from '@/src/components/Button';
import ScreenHeader from '@/src/components/ScreenHeader';
import TokenPenaltyBanner from '@/src/components/TokenPenaltyBanner';
import type { Challenge, DuoChallengeRequest } from '@/src/types/database';

interface FriendProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface DuoRequestView extends DuoChallengeRequest {
  inviter_profile?: FriendProfile | null;
}

interface DuoActivityItem {
  id: string;
  challengeId: string;
  challengeTitle: string;
  proofDate: string;
  verified: boolean;
}

function displayName(profile: Pick<FriendProfile, 'display_name' | 'username'>): string {
  return profile.display_name || profile.username;
}

export default function TeamUpScreen() {
  const router = useRouter();
  const { profile, session } = useAuthStore();
  const { fetchChallenges } = useChallengeStore();
  const { fetchBalance } = useStakeStore();
  const userId = profile?.id ?? session?.user?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<DuoRequestView[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<DuoRequestView[]>([]);
  const [friendChallenges, setFriendChallenges] = useState<Challenge[]>([]);
  const [activities, setActivities] = useState<DuoActivityItem[]>([]);
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null);
  const [nudgedFriendIds, setNudgedFriendIds] = useState<Record<string, boolean>>({});

  const selectedFriend = useMemo(
    () => friends.find((friend) => friend.id === selectedFriendId) ?? null,
    [friends, selectedFriendId],
  );

  const loadFriends = useCallback(async () => {
    if (!userId) return;

    const { data: pairs, error: pairError } = await supabase
      .from('buddy_pairs')
      .select('user_id, buddy_id')
      .eq('status', 'active')
      .or(`user_id.eq.${userId},buddy_id.eq.${userId}`);

    if (pairError) throw pairError;

    const friendIds = new Set<string>();
    (pairs ?? []).forEach((row) => {
      const pair = row as { user_id: string; buddy_id: string };
      friendIds.add(pair.user_id === userId ? pair.buddy_id : pair.user_id);
    });

    if (friendIds.size === 0) {
      setFriends([]);
      setSelectedFriendId(null);
      return;
    }

    const { data: friendRows, error: friendError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', Array.from(friendIds));
    if (friendError) throw friendError;

    const nextFriends = (friendRows ?? []) as FriendProfile[];
    setFriends(nextFriends);
    setSelectedFriendId((prev) => prev ?? nextFriends[0]?.id ?? null);
  }, [userId]);

  const loadRequests = useCallback(async () => {
    if (!userId) return;

    const [{ data: incoming, error: incomingError }, { data: outgoing, error: outgoingError }] = await Promise.all([
      supabase
        .from('duo_challenge_requests')
        .select('*')
        .eq('invitee_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('duo_challenge_requests')
        .select('*')
        .eq('inviter_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ]);

    if (incomingError) throw incomingError;
    if (outgoingError) throw outgoingError;

    const inviterIds = Array.from(
      new Set((incoming ?? []).map((item) => (item as DuoChallengeRequest).inviter_id)),
    );
    const inviteeIds = Array.from(
      new Set((outgoing ?? []).map((item) => (item as DuoChallengeRequest).invitee_id)),
    );
    const profileIds = Array.from(new Set([...inviterIds, ...inviteeIds]));

    let profilesById = new Map<string, FriendProfile>();
    if (profileIds.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', profileIds);
      profilesById = new Map(
        ((profileRows ?? []) as FriendProfile[]).map((row) => [row.id, row]),
      );
    }

    setIncomingRequests(
      ((incoming ?? []) as DuoChallengeRequest[]).map((req) => ({
        ...req,
        inviter_profile: profilesById.get(req.inviter_id) ?? null,
      })),
    );

    setOutgoingRequests(
      ((outgoing ?? []) as DuoChallengeRequest[]).map((req) => ({
        ...req,
        inviter_profile: profilesById.get(req.invitee_id) ?? null,
      })),
    );
  }, [userId]);

  const loadFriendDuoData = useCallback(async () => {
    if (!userId || !selectedFriendId) {
      setFriendChallenges([]);
      setActivities([]);
      return;
    }

    const { data: challengeRows, error: challengeError } = await supabase
      .from('challenges')
      .select('*')
      .eq('user_id', selectedFriendId)
      .eq('challenge_mode', 'duo')
      .eq('accountability_partner_id', userId)
      .order('updated_at', { ascending: false });

    if (challengeError) throw challengeError;

    const nextChallenges = (challengeRows ?? []) as Challenge[];
    setFriendChallenges(nextChallenges);

    const challengeIds = nextChallenges.map((challenge) => challenge.id);
    if (challengeIds.length === 0) {
      setActivities([]);
      return;
    }

    const { data: proofRows, error: proofError } = await supabase
      .from('daily_proofs')
      .select('id, challenge_id, proof_date, is_verified')
      .in('challenge_id', challengeIds)
      .order('created_at', { ascending: false })
      .limit(25);

    if (proofError) throw proofError;

    const titleByChallenge = new Map(nextChallenges.map((challenge) => [challenge.id, challenge.title]));
    const feed = (proofRows ?? []).map((proof: any) => ({
      id: proof.id,
      challengeId: proof.challenge_id,
      challengeTitle: titleByChallenge.get(proof.challenge_id) ?? 'Challenge',
      proofDate: proof.proof_date,
      verified: proof.is_verified === true,
    })) as DuoActivityItem[];

    setActivities(feed);
  }, [selectedFriendId, userId]);

  const loadAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      await Promise.all([loadFriends(), loadRequests(), fetchChallenges(), fetchBalance()]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Load failed', message);
    } finally {
      setLoading(false);
    }
  }, [fetchBalance, fetchChallenges, loadFriends, loadRequests, userId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  useEffect(() => {
    const run = async () => {
      try {
        await loadFriendDuoData();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        Alert.alert('Could not load duo activity', message);
      }
    };
    run();
  }, [loadFriendDuoData]);

  const handleCreateDuoChallenge = () => {
    if (!selectedFriend) {
      Alert.alert('Select a friend', 'Pick one friend first.');
      return;
    }

    router.push({
      pathname: '/challenge/create',
      params: {
        templateTitle: `Duo Challenge with ${displayName(selectedFriend)}`,
        templateCategory: 'fitness',
        templateDifficulty: 'medium',
        templateDuration: '30',
        templateFrequency: 'daily',
        templateDescription: `Accountability challenge with @${selectedFriend.username}. Verify daily to avoid token loss.`,
        duoBuddyId: selectedFriend.id,
        duoBuddyUsername: selectedFriend.username,
      },
    });
  };

  const handleAcceptRequest = async (requestId: string) => {
    setRespondingRequestId(requestId);
    try {
      const { error } = await supabase.rpc('accept_duo_challenge_request', {
        p_request_id: requestId,
      });
      if (error) throw error;

      Alert.alert('Challenge joined', 'Duo challenge accepted and started.');
      await loadAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Could not accept request', message);
    } finally {
      setRespondingRequestId(null);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    setRespondingRequestId(requestId);
    try {
      const { error } = await supabase
        .from('duo_challenge_requests')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('id', requestId)
        .eq('status', 'pending');
      if (error) throw error;

      await loadRequests();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Could not decline', message);
    } finally {
      setRespondingRequestId(null);
    }
  };

  const handleNudge = (friendId: string) => {
    setNudgedFriendIds((prev) => ({ ...prev, [friendId]: true }));
    const friend = friends.find((item) => item.id === friendId);
    if (friend) {
      Alert.alert('Nudge sent', `Reminder sent to @${friend.username}.`);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Team up with friends" showBack onBack={() => router.back()} />

      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={loadAll}
        ListHeaderComponent={
          <View>
            <TokenPenaltyBanner compact />

            {incomingRequests.length > 0 && (
              <Card style={styles.requestCard}>
                <Text style={styles.sectionTitle}>Incoming duo requests</Text>
                {incomingRequests.map((request) => (
                  <View key={request.id} style={styles.requestRow}>
                    <View style={styles.requestMeta}>
                      <Text style={styles.requestTitle}>{request.title}</Text>
                      <Text style={styles.requestSub}>
                        From @{request.inviter_profile?.username ?? 'friend'} · stake {request.stake_cents}
                      </Text>
                    </View>
                    <View style={styles.requestActions}>
                      <Button
                        title="Accept"
                        size="sm"
                        onPress={() => handleAcceptRequest(request.id)}
                        loading={respondingRequestId === request.id}
                      />
                      <Button
                        title="Decline"
                        size="sm"
                        variant="outline"
                        onPress={() => handleDeclineRequest(request.id)}
                        disabled={respondingRequestId === request.id}
                      />
                    </View>
                  </View>
                ))}
              </Card>
            )}

            {outgoingRequests.length > 0 && (
              <Card style={styles.requestCard}>
                <Text style={styles.sectionTitle}>Pending sent invites</Text>
                {outgoingRequests.map((request) => (
                  <View key={request.id} style={styles.pendingRow}>
                    <Text style={styles.pendingText}>
                      @{request.inviter_profile?.username ?? 'friend'} · {request.title}
                    </Text>
                    <Text style={styles.pendingStatus}>Pending</Text>
                  </View>
                ))}
              </Card>
            )}

            <Card style={styles.friendsCard}>
              <View style={styles.friendsHeader}>
                <Text style={styles.sectionTitle}>Friends</Text>
                <View style={styles.friendActions}>
                  <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/buddy/requests')}>
                    <Ionicons name="mail-unread-outline" size={18} color={colors.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/buddy/invite')}>
                    <Ionicons name="person-add-outline" size={18} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>

              {friends.length === 0 ? (
                <View style={styles.emptyFriends}>
                  <Text style={styles.emptyFriendsTitle}>No active buddy yet</Text>
                  <Text style={styles.emptyFriendsBody}>
                    Add a friend and start shared challenges with real progress tracking.
                  </Text>
                  <Button title="Invite friend" onPress={() => router.push('/buddy/invite')} size="sm" />
                </View>
              ) : (
                <FlatList
                  horizontal
                  data={friends}
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.friendRow}
                  renderItem={({ item }) => {
                    const active = item.id === selectedFriendId;
                    const nudgeDone = nudgedFriendIds[item.id] === true;
                    return (
                      <View style={[styles.friendChip, active && styles.friendChipActive]}>
                        <TouchableOpacity onPress={() => setSelectedFriendId(item.id)} style={styles.friendTap}>
                          <Avatar
                            uri={item.avatar_url}
                            size="md"
                            fallback={displayName(item).slice(0, 2).toUpperCase()}
                          />
                          <Text numberOfLines={1} style={styles.friendName}>
                            {displayName(item)}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.nudgeBtn, nudgeDone && styles.nudgeBtnDone]}
                          onPress={() => handleNudge(item.id)}
                        >
                          <Ionicons
                            name="notifications-outline"
                            size={12}
                            color={nudgeDone ? colors.white : colors.accent}
                          />
                          <Text style={[styles.nudgeText, nudgeDone && styles.nudgeTextDone]}>
                            {nudgeDone ? 'Nudged' : 'Nudge'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }}
                />
              )}
            </Card>

            <Card style={styles.duoCard}>
              <Text style={styles.sectionTitle}>Duo challenge room</Text>
              <Text style={styles.duoSub}>
                {selectedFriend
                  ? `Selected friend: @${selectedFriend.username}`
                  : 'Pick a friend to start a duo challenge.'}
              </Text>
              <View style={styles.duoButtons}>
                <Button title="Create duo challenge" onPress={handleCreateDuoChallenge} size="sm" />
                <Button
                  title="Open progress board"
                  onPress={() => router.push('/(tabs)/habits')}
                  variant="outline"
                  size="sm"
                />
              </View>
            </Card>

            {selectedFriend && (
              <View style={styles.activityHeader}>
                <Text style={styles.activityTitle}>Live activity · @{selectedFriend.username}</Text>
              </View>
            )}

            {friendChallenges.length > 0 && (
              <View style={styles.challengeList}>
                {friendChallenges.map((challenge) => {
                  const progress = challenge.required_completions > 0
                    ? Math.min(1, challenge.completed_days / challenge.required_completions)
                    : 0;
                  return (
                    <Card
                      key={challenge.id}
                      style={styles.challengeCard}
                      onPress={() => router.push(`/challenge/${challenge.id}`)}
                    >
                      <Text style={styles.challengeTitle}>{challenge.title}</Text>
                      <Text style={styles.challengeMeta}>
                        {challenge.completed_days}/{challenge.required_completions} · {challenge.frequency}
                      </Text>
                      <View style={styles.challengeBarBg}>
                        <View style={[styles.challengeBarFill, { width: `${Math.round(progress * 100)}%` }]} />
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.activityCard}>
            <View style={styles.activityTop}>
              <Text style={styles.activityName}>{item.challengeTitle}</Text>
              <Text style={styles.activityTime}>{format(new Date(item.proofDate), 'MMM d')}</Text>
            </View>
            <Text style={styles.activityText}>
              {item.verified ? 'Daily proof verified ✅' : 'Proof submitted (not verified) ⏳'}
            </Text>
          </Card>
        )}
        ListEmptyComponent={
          <Card style={styles.emptyActivity}>
            <Text style={styles.emptyActivityTitle}>No duo activity yet</Text>
            <Text style={styles.emptyActivityText}>
              Create or accept a duo challenge to see your friend&apos;s real check-ins here.
            </Text>
          </Card>
        }
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
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.title3,
    color: colors.textPrimary,
  },
  requestCard: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  requestRow: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.sm,
  },
  requestMeta: {
    marginBottom: spacing.sm,
  },
  requestTitle: {
    ...typography.headline,
    color: colors.textPrimary,
  },
  requestSub: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pendingRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  pendingText: {
    ...typography.subhead,
    color: colors.textPrimary,
    flex: 1,
  },
  pendingStatus: {
    ...typography.caption1,
    color: colors.warning,
    fontWeight: '700',
  },
  friendsCard: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  friendsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  friendActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  emptyFriends: {
    paddingVertical: spacing.md,
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  emptyFriendsTitle: {
    ...typography.headline,
    color: colors.textPrimary,
  },
  emptyFriendsBody: {
    ...typography.footnote,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  friendRow: {
    gap: spacing.sm,
  },
  friendChip: {
    width: 104,
    borderRadius: borderRadius.md,
    backgroundColor: '#111A2E',
    borderWidth: 1,
    borderColor: '#2B3E61',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  friendChipActive: {
    borderColor: '#4A9EFF',
    backgroundColor: '#0E2248',
  },
  friendTap: {
    alignItems: 'center',
    width: '100%',
  },
  friendName: {
    ...typography.caption1,
    color: colors.white,
    marginTop: spacing.xs,
    textAlign: 'center',
    fontWeight: '600',
  },
  nudgeBtn: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#3A5B90',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 3,
    backgroundColor: '#11284F',
  },
  nudgeBtnDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  nudgeText: {
    ...typography.caption2,
    color: colors.accent,
    fontWeight: '700',
  },
  nudgeTextDone: {
    color: colors.white,
  },
  duoCard: {
    marginBottom: spacing.md,
    backgroundColor: '#FFF8E1',
    borderColor: '#F1D99B',
  },
  duoSub: {
    ...typography.subhead,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  duoButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  activityHeader: {
    marginBottom: spacing.sm,
  },
  activityTitle: {
    ...typography.headline,
    color: colors.textPrimary,
  },
  challengeList: {
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  challengeCard: {
    backgroundColor: '#EEF4FF',
    borderColor: '#D2E2FF',
  },
  challengeTitle: {
    ...typography.headline,
    color: colors.textPrimary,
  },
  challengeMeta: {
    ...typography.caption1,
    color: colors.textSecondary,
    marginTop: 2,
  },
  challengeBarBg: {
    marginTop: spacing.sm,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CCDDFB',
    overflow: 'hidden',
  },
  challengeBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  activityCard: {
    marginBottom: spacing.sm,
    backgroundColor: '#0F1A33',
    borderColor: '#24385E',
  },
  activityTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityName: {
    ...typography.headline,
    color: '#F1F6FF',
  },
  activityTime: {
    ...typography.caption1,
    color: '#9DB2D8',
  },
  activityText: {
    ...typography.subhead,
    color: '#D6E3FB',
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  emptyActivity: {
    marginTop: spacing.md,
  },
  emptyActivityTitle: {
    ...typography.headline,
    color: colors.textPrimary,
  },
  emptyActivityText: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
});

