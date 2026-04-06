import { create } from 'zustand';
import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns';
import { supabase } from '@/src/lib/supabase';
import type {
  Challenge,
  ChallengeCategory,
  ChallengeFrequency,
  ChallengeStatus,
  DailyProof,
  Profile,
  StakeBalance,
  VerificationType,
  VerificationConfig,
} from '@/src/types/database';

const FIRST_CHALLENGE_BONUS = 200;

type FinalChallengeStatus = Extract<ChallengeStatus, 'completed_success' | 'completed_fail'>;
type ProfileSettlementSnapshot = Pick<
  Profile,
  'total_challenges' | 'total_wins' | 'total_losses' | 'current_streak' | 'longest_streak' | 'total_lost_cents' | 'xp'
>;
type StakeSettlementSnapshot = Pick<
  StakeBalance,
  'id' | 'balance_cents' | 'total_returned_cents' | 'total_forfeited_cents'
>;
type DailyProofSnapshot = Pick<DailyProof, 'proof_date' | 'is_verified'>;
type ChallengeProofRow = Pick<DailyProof, 'challenge_id' | 'proof_date' | 'is_verified'>;

interface CreateChallengeInput {
  title: string;
  description: string | null;
  category: ChallengeCategory;
  frequency: ChallengeFrequency;
  duration_days: number;
  required_completions: number;
  start_date: string;
  end_date: string;
  stake_cents: number;
  verification_type: VerificationType;
  verification_config: VerificationConfig | null;
  status: 'active';
  completed_days: number;
  failed_days: number;
}

interface ChallengeState {
  challenges: Challenge[];
  loading: boolean;
  error: string | null;

  fetchChallenges: () => Promise<void>;
  syncActiveChallenges: () => Promise<void>;
  fetchChallengeById: (id: string) => Promise<Challenge | null>;
  createChallenge: (input: CreateChallengeInput) => Promise<Challenge>;
  updateChallenge: (id: string, updates: Partial<Challenge>) => Promise<void>;
  clearError: () => void;
}

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

function computeLevelFromXp(xp: number): number {
  return Math.max(1, Math.floor(xp / 1000) + 1);
}

function getChallengeProgress(
  challenge: Challenge,
  proofs: DailyProofSnapshot[],
): {
  completedDays: number;
  failedDays: number;
  finalStatus: FinalChallengeStatus | null;
} {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');

  const verifiedDates = new Set(
    proofs
      .filter((p) => p.is_verified)
      .map((p) => p.proof_date)
      .filter((date) => date >= challenge.start_date && date <= challenge.end_date),
  );

  const completedDays = verifiedDates.size;

  let failedDays = 0;
  const pastDueEnd = challenge.end_date < yesterdayStr ? challenge.end_date : yesterdayStr;

  if (pastDueEnd >= challenge.start_date) {
    const expectedDays = differenceInCalendarDays(
      parseISO(pastDueEnd),
      parseISO(challenge.start_date),
    ) + 1;

    let verifiedPastDue = 0;
    verifiedDates.forEach((date) => {
      if (date <= pastDueEnd) {
        verifiedPastDue += 1;
      }
    });
    failedDays = Math.max(0, expectedDays - verifiedPastDue);
  }

  const hasEnded = todayStr > challenge.end_date;
  const missedRequiredDay = challenge.frequency === 'daily' && failedDays > 0;

  let finalStatus: FinalChallengeStatus | null = null;
  if (missedRequiredDay || (hasEnded && completedDays < challenge.required_completions)) {
    finalStatus = 'completed_fail';
  } else if (hasEnded && completedDays >= challenge.required_completions) {
    finalStatus = 'completed_success';
  }

  return { completedDays, failedDays, finalStatus };
}

async function getStakeBalanceForUser(userId: string): Promise<StakeSettlementSnapshot> {
  const select = 'id, balance_cents, total_returned_cents, total_forfeited_cents';
  const { data, error } = await supabase
    .from('stake_balances')
    .select(select)
    .eq('user_id', userId)
    .single();

  if (!error && data) {
    return data as StakeSettlementSnapshot;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('stake_balances')
    .insert({
      user_id: userId,
      balance_cents: 0,
      total_purchased_cents: 0,
      total_returned_cents: 0,
      total_forfeited_cents: 0,
    })
    .select(select)
    .single();

  if (insertError || !inserted) {
    throw insertError ?? new Error('Failed to initialize stake balance');
  }

  return inserted as StakeSettlementSnapshot;
}

async function settleChallengeOutcome(
  challenge: Challenge,
  finalStatus: FinalChallengeStatus,
  completedDays: number,
) {
  const xpEarned =
    finalStatus === 'completed_success'
      ? Math.round(challenge.duration_days * 10 + challenge.stake_cents / 10)
      : Math.round(completedDays * 5);

  const [{ data: profile, error: profileError }, stakeBalance] = await Promise.all([
    supabase
      .from('profiles')
      .select('total_challenges, total_wins, total_losses, current_streak, longest_streak, total_lost_cents, xp')
      .eq('id', challenge.user_id)
      .single(),
    getStakeBalanceForUser(challenge.user_id),
  ]);

  if (profileError || !profile) {
    throw profileError ?? new Error('Failed to read profile for settlement');
  }

  const profileSnapshot = profile as ProfileSettlementSnapshot;
  const nextXp = profileSnapshot.xp + xpEarned;
  const nowIso = new Date().toISOString();

  if (finalStatus === 'completed_success') {
    const nextWins = profileSnapshot.total_wins + 1;
    const isFirstWin = nextWins === 1;
    const returnedTokens = challenge.stake_cents + (isFirstWin ? FIRST_CHALLENGE_BONUS : 0);

    const { error: stakeError } = await supabase
      .from('stake_balances')
      .update({
        balance_cents: stakeBalance.balance_cents + returnedTokens,
        total_returned_cents: stakeBalance.total_returned_cents + returnedTokens,
        updated_at: nowIso,
      })
      .eq('id', stakeBalance.id);
    if (stakeError) throw stakeError;

    const nextCurrentStreak = profileSnapshot.current_streak + 1;
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        total_challenges: profileSnapshot.total_challenges + 1,
        total_wins: nextWins,
        current_streak: nextCurrentStreak,
        longest_streak: Math.max(profileSnapshot.longest_streak, nextCurrentStreak),
        xp: nextXp,
        level: computeLevelFromXp(nextXp),
        updated_at: nowIso,
      })
      .eq('id', challenge.user_id);
    if (profileUpdateError) throw profileUpdateError;

    return;
  }

  const { error: stakeError } = await supabase
    .from('stake_balances')
    .update({
      total_forfeited_cents: stakeBalance.total_forfeited_cents + challenge.stake_cents,
      updated_at: nowIso,
    })
    .eq('id', stakeBalance.id);
  if (stakeError) throw stakeError;

  const { error: profileUpdateError } = await supabase
    .from('profiles')
    .update({
      total_challenges: profileSnapshot.total_challenges + 1,
      total_losses: profileSnapshot.total_losses + 1,
      total_lost_cents: profileSnapshot.total_lost_cents + challenge.stake_cents,
      current_streak: 0,
      xp: nextXp,
      level: computeLevelFromXp(nextXp),
      updated_at: nowIso,
    })
    .eq('id', challenge.user_id);
  if (profileUpdateError) throw profileUpdateError;
}

export const useChallengeStore = create<ChallengeState>((set, get) => ({
  challenges: [],
  loading: false,
  error: null,

  fetchChallenges: async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    set({ loading: true, error: null });
    try {
      await get().syncActiveChallenges();

      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ challenges: (data ?? []) as Challenge[] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch challenges';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  syncActiveChallenges: async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    try {
      const { data: activeChallenges, error: activeError } = await supabase
        .from('challenges')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (activeError) throw activeError;

      if (!activeChallenges || activeChallenges.length === 0) return;

      const challengeIds = activeChallenges.map((challenge) => challenge.id);
      const { data: proofs, error: proofError } = await supabase
        .from('daily_proofs')
        .select('challenge_id, proof_date, is_verified')
        .in('challenge_id', challengeIds);
      if (proofError) throw proofError;

      const proofsByChallenge = new Map<string, DailyProofSnapshot[]>();
      (proofs ?? []).forEach((proof) => {
        const list = proofsByChallenge.get(proof.challenge_id) ?? [];
        list.push(proof as ChallengeProofRow);
        proofsByChallenge.set(proof.challenge_id, list);
      });

      for (const active of activeChallenges as Challenge[]) {
        const challengeProofs = proofsByChallenge.get(active.id) ?? [];
        const { completedDays, failedDays, finalStatus } = getChallengeProgress(active, challengeProofs);
        const needsCountUpdate =
          active.completed_days !== completedDays || active.failed_days !== failedDays;

        if (!finalStatus && !needsCountUpdate) {
          continue;
        }

        if (finalStatus) {
          const { data: finalizedChallenge, error: finalizeError } = await supabase
            .from('challenges')
            .update({
              status: finalStatus,
              completed_days: completedDays,
              failed_days: failedDays,
              updated_at: new Date().toISOString(),
            })
            .eq('id', active.id)
            .eq('status', 'active')
            .select('*')
            .maybeSingle();

          if (finalizeError) {
            throw finalizeError;
          }

          if (!finalizedChallenge) {
            continue;
          }

          await settleChallengeOutcome(
            finalizedChallenge as Challenge,
            finalStatus,
            completedDays,
          );

          continue;
        }

        const { error: updateError } = await supabase
          .from('challenges')
          .update({
            completed_days: completedDays,
            failed_days: failedDays,
            updated_at: new Date().toISOString(),
          })
          .eq('id', active.id)
          .eq('status', 'active');
        if (updateError) throw updateError;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync challenges';
      set({ error: message });
    }
  },

  fetchChallengeById: async (id) => {
    try {
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Challenge;
    } catch {
      return null;
    }
  },

  createChallenge: async (input) => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('challenges')
        .insert({
          user_id: userId,
          ...input,
        })
        .select()
        .single();
      if (error) throw error;
      const challenge = data as Challenge;
      set({ challenges: [challenge, ...get().challenges] });
      return challenge;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create challenge';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  updateChallenge: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('challenges')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      const updated = data as Challenge;
      set({
        challenges: get().challenges.map((c) => (c.id === id ? updated : c)),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update challenge';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
