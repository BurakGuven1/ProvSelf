// Supabase Edge Function: process-challenge
// Syncs active challenge progress and finalizes success/failure outcomes.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FIRST_CHALLENGE_BONUS = 200;

type ChallengeStatus = 'active' | 'completed_success' | 'completed_fail' | 'cancelled';

interface ChallengeRow {
  id: string;
  user_id: string;
  frequency: 'daily' | 'weekly';
  start_date: string;
  end_date: string;
  required_completions: number;
  duration_days: number;
  stake_cents: number;
  completed_days: number;
  failed_days: number;
  status: ChallengeStatus;
  // Cumulative no-proof-day penalty bucket. Subtracted from the returned
  // stake on success. Nullable for legacy rows from before migration 00005.
  manual_override_penalty_cents: number | null;
}

interface ProofRow {
  proof_date: string;
  is_verified: boolean;
}

function dateDiffInDays(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  return Math.floor((endDate.getTime() - startDate.getTime()) / 86400000);
}

function getWeekSlotKey(startDate: string, proofDate: string): string {
  const diff = dateDiffInDays(startDate, proofDate);
  const index = Math.max(0, Math.floor(diff / 7));
  return `w${index}`;
}

function countVerifiedSlots(
  challenge: ChallengeRow,
  proofs: ProofRow[],
  boundaryEnd?: string,
): number {
  const end = boundaryEnd ?? challenge.end_date;
  const slotKeys = new Set<string>();

  for (const proof of proofs) {
    if (!proof.is_verified) continue;
    if (proof.proof_date < challenge.start_date || proof.proof_date > challenge.end_date) continue;
    if (proof.proof_date > end) continue;

    if (challenge.frequency === 'weekly') {
      slotKeys.add(getWeekSlotKey(challenge.start_date, proof.proof_date));
    } else {
      slotKeys.add(proof.proof_date);
    }
  }

  return slotKeys.size;
}

function expectedSlotsUntil(challenge: ChallengeRow, pastDueEnd: string): number {
  if (pastDueEnd < challenge.start_date) return 0;
  const elapsedDays = dateDiffInDays(challenge.start_date, pastDueEnd) + 1;
  if (challenge.frequency === 'weekly') {
    return Math.floor((elapsedDays - 1) / 7) + 1;
  }
  return elapsedDays;
}

function getProgress(
  challenge: ChallengeRow,
  proofs: ProofRow[],
  todayStr: string,
  yesterdayStr: string,
): {
  completedDays: number;
  failedDays: number;
  finalStatus: Extract<ChallengeStatus, 'completed_success' | 'completed_fail'> | null;
} {
  const completedDays = countVerifiedSlots(challenge, proofs);

  let failedDays = 0;
  const pastDueEnd = challenge.end_date < yesterdayStr ? challenge.end_date : yesterdayStr;

  const expectedDays = expectedSlotsUntil(challenge, pastDueEnd);
  const verifiedPastDue = countVerifiedSlots(challenge, proofs, pastDueEnd);
  failedDays = Math.max(0, expectedDays - verifiedPastDue);

  const hasEnded = todayStr > challenge.end_date;
  const missedRequiredDay = challenge.frequency === 'daily' && failedDays > 0;

  let finalStatus: Extract<ChallengeStatus, 'completed_success' | 'completed_fail'> | null = null;
  if (missedRequiredDay || (hasEnded && completedDays < challenge.required_completions)) {
    finalStatus = 'completed_fail';
  } else if (hasEnded && completedDays >= challenge.required_completions) {
    finalStatus = 'completed_success';
  }

  return { completedDays, failedDays, finalStatus };
}

serve(async () => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const yesterday = new Date(now.getTime() - 86400000);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const { data: activeChallenges, error: fetchError } = await supabase
      .from('challenges')
      .select('*')
      .eq('status', 'active')
      .lte('start_date', todayStr);

    if (fetchError) throw fetchError;
    if (!activeChallenges || activeChallenges.length === 0) {
      return new Response(JSON.stringify({ processed: 0, finalized: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;
    let finalized = 0;

    for (const challenge of activeChallenges as ChallengeRow[]) {
      const { data: proofs, error: proofError } = await supabase
        .from('daily_proofs')
        .select('proof_date, is_verified')
        .eq('challenge_id', challenge.id);

      if (proofError) {
        console.error(`[process-challenge] proofs read failed challenge=${challenge.id}`, proofError);
        continue;
      }

      const { completedDays, failedDays, finalStatus } = getProgress(
        challenge,
        (proofs ?? []) as ProofRow[],
        todayStr,
        yesterdayStr,
      );

      const needsCountUpdate =
        challenge.completed_days !== completedDays || challenge.failed_days !== failedDays;

      if (!finalStatus && !needsCountUpdate) {
        continue;
      }

      if (!finalStatus) {
        const { error: updateError } = await supabase
          .from('challenges')
          .update({
            completed_days: completedDays,
            failed_days: failedDays,
            updated_at: new Date().toISOString(),
          })
          .eq('id', challenge.id)
          .eq('status', 'active');

        if (updateError) {
          console.error(`[process-challenge] update counts failed challenge=${challenge.id}`, updateError);
          continue;
        }

        processed += 1;
        continue;
      }

      const { data: finalizedChallenge, error: finalizeUpdateError } = await supabase
        .from('challenges')
        .update({
          status: finalStatus,
          completed_days: completedDays,
          failed_days: failedDays,
          updated_at: new Date().toISOString(),
        })
        .eq('id', challenge.id)
        .eq('status', 'active')
        .select('*')
        .maybeSingle();

      if (finalizeUpdateError) {
        console.error(`[process-challenge] finalize update failed challenge=${challenge.id}`, finalizeUpdateError);
        continue;
      }

      if (!finalizedChallenge) {
        continue;
      }

      const finalizedChallengeRow = finalizedChallenge as ChallengeRow;
      const xpEarned = finalStatus === 'completed_success'
        ? Math.round(
            finalizedChallengeRow.duration_days * 10 + finalizedChallengeRow.stake_cents / 10,
          )
        : Math.round(completedDays * 5);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('total_challenges, total_wins, total_losses, current_streak, longest_streak, total_lost_cents, xp')
        .eq('id', finalizedChallengeRow.user_id)
        .single();

      if (profileError || !profile) {
        console.error(`[process-challenge] profile read failed challenge=${challenge.id}`, profileError);
        continue;
      }

      if (finalStatus === 'completed_success') {
        const nextWins = profile.total_wins + 1;
        const isFirstWin = nextWins === 1;
        // Apply the cumulative no-proof penalty against the principal,
        // capped to the stake itself. The corresponding "lost" amount is
        // booked to total_lost_cents below so the user's lifetime stats
        // stay consistent with the per-challenge UI.
        const rawPenalty = finalizedChallengeRow.manual_override_penalty_cents ?? 0;
        const cappedPenalty = Math.min(
          finalizedChallengeRow.stake_cents,
          Math.max(0, rawPenalty),
        );
        const principalReturned = Math.max(
          0,
          finalizedChallengeRow.stake_cents - cappedPenalty,
        );
        const returnedAmount = principalReturned + (isFirstWin ? FIRST_CHALLENGE_BONUS : 0);

        await supabase.rpc('return_stake', {
          p_user_id: finalizedChallengeRow.user_id,
          p_amount: returnedAmount,
        });

        const nextCurrentStreak = profile.current_streak + 1;
        const nextXp = profile.xp + xpEarned;

        await supabase
          .from('profiles')
          .update({
            total_challenges: profile.total_challenges + 1,
            total_wins: nextWins,
            current_streak: nextCurrentStreak,
            longest_streak: Math.max(profile.longest_streak, nextCurrentStreak),
            total_lost_cents: profile.total_lost_cents + cappedPenalty,
            xp: nextXp,
            level: Math.max(1, Math.floor(nextXp / 1000) + 1),
            updated_at: new Date().toISOString(),
          })
          .eq('id', finalizedChallengeRow.user_id);
      } else {
        await supabase.rpc('forfeit_stake', {
          p_user_id: finalizedChallengeRow.user_id,
          p_amount: finalizedChallengeRow.stake_cents,
        });

        const nextXp = profile.xp + xpEarned;

        await supabase
          .from('profiles')
          .update({
            total_challenges: profile.total_challenges + 1,
            total_losses: profile.total_losses + 1,
            total_lost_cents: profile.total_lost_cents + finalizedChallengeRow.stake_cents,
            current_streak: 0,
            xp: nextXp,
            level: Math.max(1, Math.floor(nextXp / 1000) + 1),
            updated_at: new Date().toISOString(),
          })
          .eq('id', finalizedChallengeRow.user_id);
      }

      processed += 1;
      finalized += 1;
    }

    return new Response(JSON.stringify({ processed, finalized }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Processing failed', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
