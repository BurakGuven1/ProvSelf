// Supabase Edge Function: validate-purchase
// Validates RevenueCat webhook events and updates stake balances atomically

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

const SUBSCRIPTION_PRODUCTS = new Set([
  'provself_pro_monthly',
  'provself_pro_yearly',
]);

const JSON_HEADERS = { 'Content-Type': 'application/json' };

serve(async (req: Request) => {
  try {
    // Verify webhook authenticity
    const authHeader = req.headers.get('Authorization');
    if (REVENUECAT_WEBHOOK_SECRET && authHeader !== `Bearer ${REVENUECAT_WEBHOOK_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: JSON_HEADERS,
      });
    }

    const body = await req.json();
    const event = body.event;

    if (!event) {
      return new Response(JSON.stringify({ error: 'Invalid event' }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const eventType = event.type as string;
    const userId = event.app_user_id as string;
    const productId = event.product_id as string;
    const transactionId = event.transaction_id as string;

    // ─── Consumable purchase (stake credits) ───
    if (
      (eventType === 'NON_RENEWING_PURCHASE' || eventType === 'INITIAL_PURCHASE') &&
      PRODUCT_CREDITS[productId]
    ) {
      const credits = PRODUCT_CREDITS[productId];

      // Atomic: insert purchase + credit balance (idempotent via unique transaction_id)
      const { error: creditError } = await supabase.rpc('credit_stake', {
        p_user_id: userId,
        p_amount: credits,
        p_transaction_id: transactionId,
        p_product_id: productId,
      });

      if (creditError) {
        // Unique violation = duplicate webhook → already processed → idempotent success
        if (creditError.code === '23505') {
          return new Response(
            JSON.stringify({ success: true, note: 'already_processed' }),
            { headers: JSON_HEADERS }
          );
        }
        throw creditError;
      }

      return new Response(
        JSON.stringify({ success: true, credits_added: credits }),
        { headers: JSON_HEADERS }
      );
    }

    // ─── Subscription events ───
    if (SUBSCRIPTION_PRODUCTS.has(productId)) {
      // Subscriptions are verified client-side via RevenueCat SDK.
      // Log the event for audit purposes.
      console.log(`[Subscription] ${eventType} for user=${userId} product=${productId}`);

      return new Response(
        JSON.stringify({ success: true, event_type: eventType }),
        { headers: JSON_HEADERS }
      );
    }

    // ─── Unknown event — acknowledge to prevent retries ───
    console.log(`[Webhook] Unhandled event: ${eventType} product=${productId}`);
    return new Response(
      JSON.stringify({ success: true, note: 'unhandled_event' }),
      { headers: JSON_HEADERS }
    );
  } catch (error) {
    console.error('[Webhook] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Validation failed', details: String(error) }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
});
