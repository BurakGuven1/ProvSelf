// Supabase Edge Function: process-challenge
// Processes completed challenges, handles stake returns/forfeitures

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

serve(async (req: Request) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find all active challenges that have ended
    const today = new Date().toISOString().split('T')[0];
    const { data: expiredChallenges, error: fetchError } = await supabase
      .from('challenges')
      .select('*')
      .eq('status', 'active')
      .lte('end_date', today);

    if (fetchError) throw fetchError;
    if (!expiredChallenges || expiredChallenges.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;

    for (const challenge of expiredChallenges) {
      const successRate = challenge.required_completions > 0
        ? challenge.completed_days / challenge.required_completions
        : 0;

      // Success if completed 80% or more of required days
      const isSuccess = successRate >= 0.8;
      const newStatus = isSuccess ? 'completed_success' : 'completed_fail';

      // Update challenge status
      await supabase
        .from('challenges')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', challenge.id);

      if (isSuccess) {
        // Return stake to user
        await supabase.rpc('return_stake', {
          p_user_id: challenge.user_id,
          p_amount: challenge.stake_cents,
        });

        // Update profile stats
        await supabase.rpc('increment_profile_stat', {
          p_user_id: challenge.user_id,
          p_column: 'total_wins',
          p_value: 1,
        });
      } else {
        // Forfeit stake
        await supabase.rpc('forfeit_stake', {
          p_user_id: challenge.user_id,
          p_amount: challenge.stake_cents,
        });

        // Update profile stats
        await supabase.rpc('increment_profile_stat', {
          p_user_id: challenge.user_id,
          p_column: 'total_losses',
          p_value: 1,
        });
        await supabase.rpc('increment_profile_stat', {
          p_user_id: challenge.user_id,
          p_column: 'total_lost_cents',
          p_value: challenge.stake_cents,
        });
      }

      // Award XP
      const xpEarned = isSuccess
        ? Math.round(challenge.duration_days * 10 + challenge.stake_cents / 10)
        : Math.round(challenge.completed_days * 5);

      await supabase.rpc('increment_profile_stat', {
        p_user_id: challenge.user_id,
        p_column: 'xp',
        p_value: xpEarned,
      });

      processed++;
    }

    return new Response(JSON.stringify({ processed }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Processing failed', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
