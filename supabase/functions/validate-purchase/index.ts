// Supabase Edge Function: validate-purchase
// Validates RevenueCat webhook events and updates stake balances

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const REVENUECAT_WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';

const PRODUCT_CREDITS: Record<string, number> = {
  provself_stake_500: 500,
  provself_stake_1000: 1000,
  provself_stake_2000: 2000,
  provself_stake_5000: 5000,
};

serve(async (req: Request) => {
  try {
    // Verify webhook authenticity
    const authHeader = req.headers.get('Authorization');
    if (REVENUECAT_WEBHOOK_SECRET && authHeader !== `Bearer ${REVENUECAT_WEBHOOK_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const event = body.event;

    if (!event) {
      return new Response(JSON.stringify({ error: 'Invalid event' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Handle non-renewing purchase (consumable stake packs)
    if (event.type === 'NON_RENEWING_PURCHASE' || event.type === 'INITIAL_PURCHASE') {
      const userId = event.app_user_id;
      const productId = event.product_id;
      const transactionId = event.transaction_id;

      const credits = PRODUCT_CREDITS[productId];
      if (!credits) {
        return new Response(JSON.stringify({ error: 'Unknown product' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Record purchase
      await supabase.from('stake_purchases').insert({
        user_id: userId,
        amount_cents: credits,
        revenue_cat_transaction_id: transactionId,
        product_id: productId,
        status: 'completed',
      });

      // Update balance
      const { data: existingBalance } = await supabase
        .from('stake_balances')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (existingBalance) {
        await supabase
          .from('stake_balances')
          .update({
            balance_cents: existingBalance.balance_cents + credits,
            total_purchased_cents: existingBalance.total_purchased_cents + credits,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
      } else {
        await supabase.from('stake_balances').insert({
          user_id: userId,
          balance_cents: credits,
          total_purchased_cents: credits,
        });
      }

      // Update profile total staked
      await supabase.rpc('increment_profile_stat', {
        p_user_id: userId,
        p_column: 'total_staked_cents',
        p_value: credits,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Validation failed', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
