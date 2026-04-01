// Supabase Edge Function: verify-photo
// Calls Claude Vision API to verify challenge proof photos

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

serve(async (req: Request) => {
  try {
    const { challenge_id, challenge_title, challenge_description, photo_url, date } =
      await req.json();

    if (!photo_url || !challenge_title) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch image and convert to base64
    const imageResponse = await fetch(photo_url);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = btoa(
      new Uint8Array(imageBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // Call Claude Vision API
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: `This user has a daily challenge: "${challenge_title}"${challenge_description ? ` (${challenge_description})` : ''}. They submitted this photo as proof of completion for today (${date}). Analyze the photo and determine:
1) Does this photo reasonably prove the challenge was completed?
2) Does the photo appear to be taken recently (not an old/stock photo)?
3) Is there any sign of fraud or manipulation?

Respond with JSON only: { "verified": true/false, "confidence": 0.0-1.0, "reasoning": "brief explanation" }`,
              },
            ],
          },
        ],
      }),
    });

    const aiData = await anthropicResponse.json();
    const aiText = aiData.content?.[0]?.text ?? '{}';

    // Parse AI response
    let result;
    try {
      result = JSON.parse(aiText);
    } catch {
      result = { verified: false, confidence: 0, reasoning: 'Could not parse AI response.' };
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Verification failed', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
