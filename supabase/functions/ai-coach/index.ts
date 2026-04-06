// Supabase Edge Function: ai-coach
// Generates personalized AI coach messages using Claude API

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

serve(async (req: Request) => {
  try {
    const { user_id, challenge_id, message_type, user_data, locale } = await req.json();

    if (!user_id || !message_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Generate coach message
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        system:
          "You are Provself's AI accountability coach. You're direct, motivating, and concise. Never preachy. Your tone is like a supportive friend who believes in the user. Keep messages under 2 sentences. Use the user's language (en/de/fr/ja). User data is provided for context.",
        messages: [
          {
            role: 'user',
            content: `Generate a ${message_type} message for this user. Context: ${JSON.stringify(user_data || {})}. Language: ${locale || 'en'}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return new Response(
        JSON.stringify({ error: 'AI coach service error', details: errBody }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await response.json();
    const content = aiData.content?.[0]?.text ?? 'Keep going! You got this.';

    // Save to database
    const { data, error } = await supabase.from('coach_messages').insert({
      user_id,
      challenge_id: challenge_id || null,
      message_type,
      content,
    }).select().single();

    if (error) throw error;

    return new Response(JSON.stringify({ message: data }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Coach message generation failed', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
