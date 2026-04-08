// Supabase Edge Function: classify-challenge
//
// Classifies a challenge into a proof class + verification policy using
// Claude Haiku. Called at challenge-creation time so the classifier's
// verdict can be stored on the challenges row (proof_class,
// verification_policy) and later read by verify-photo to enforce rules.
//
// This is language-agnostic — Haiku handles all 11 supported UI locales
// and any other natural language, without per-language regex. Phase 1.5-B
// replaces the Phase 1 hydration regex guard with this classifier.
//
// Contract:
//   Request body:
//     { title: string, description?: string, category?: string }
//   2xx response (success):
//     {
//       proof_class: "high" | "medium" | "low",
//       recommended_method: "healthkit" | "photo_ai",
//       verification_policy: {
//         allowed_methods: ("healthkit" | "photo_ai")[],
//         hard_block_methods: ("healthkit" | "photo_ai")[],
//         min_evidence_count: number,
//         time_window_hours: number
//       },
//       reasoning: string
//     }
//   Non-2xx response (failure): { error: string, ... }
//     On non-2xx the client must NOT deduct stake or create the challenge.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

type ProofClass = 'high' | 'medium' | 'low';
type VerificationMethod = 'healthkit' | 'photo_ai';

const ALLOWED_CLASSES: ProofClass[] = ['high', 'medium', 'low'];
const ALLOWED_METHODS: VerificationMethod[] = ['healthkit', 'photo_ai'];

const CLASSIFIER_SYSTEM_PROMPT = `You are a verification policy classifier for a habit-tracking app. Given a user's daily challenge (title, optional description, optional category), output a strict JSON verification policy.

The app supports these verification methods:
- "healthkit": Apple HealthKit sensor data (steps, active calories, exercise minutes, sleep duration, distance walked/run, water intake)
- "photo_ai": A single photo captured each day, verified by AI vision

Proof class taxonomy:
- "high" = SENSOR-MEASURABLE. The habit has a direct HealthKit metric and a single photo cannot prove it. Examples: "10k steps", "run 5km", "sleep 8 hours", "burn 500 calories", "30 min exercise".
- "medium" = SINGLE-FRAME VISUAL PROOF. A single in-the-moment photo can reasonably show the habit happened. Examples: "yoga pose", "read one book chapter", "cook a healthy meal", "stretch routine", "gym selfie", "journal entry", "tidy desk", "water plants".
- "low" = BEHAVIORAL / ACCUMULATIVE / ABSTINENCE. No single photo can prove the whole-day behavior. Examples: "drink 2L water", "no sugar", "no social media", "meditate 10 min", "gratitude practice", "intermittent fasting", "no smoking", "floss daily", "no junk food".

Rules (apply strictly):
- proof_class "high" → allowed_methods=["healthkit"], hard_block_methods=["photo_ai"], min_evidence_count=1, time_window_hours=24.
- proof_class "medium" → allowed_methods=["photo_ai"], hard_block_methods=[], min_evidence_count=1, time_window_hours=24.
- proof_class "low" WITH a HealthKit match (water intake, sleep, distance) → allowed_methods=["healthkit"], hard_block_methods=["photo_ai"], min_evidence_count=1, time_window_hours=24.
- proof_class "low" WITHOUT a HealthKit match (sugar, social media, meditation, smoking, flossing) → allowed_methods=["photo_ai"], hard_block_methods=[], min_evidence_count=3, time_window_hours=24. (Photo becomes an honor-system multi-checkin fallback.)

Language: the challenge may be in ANY natural language. Classify based on semantic meaning regardless of surface vocabulary. Never refuse due to language.

Respond with ONLY this JSON, no markdown fences, no commentary:
{
  "proof_class": "high" | "medium" | "low",
  "recommended_method": "healthkit" | "photo_ai",
  "verification_policy": {
    "allowed_methods": ["healthkit" | "photo_ai"],
    "hard_block_methods": ["photo_ai"] or [],
    "min_evidence_count": 1 or 3,
    "time_window_hours": 24
  },
  "reasoning": "one short sentence explaining the decision"
}`;

function jsonError(status: number, error: string, extra?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ error, ...(extra ?? {}) }),
    { status, headers: JSON_HEADERS },
  );
}

serve(async (req: Request) => {
  console.log('[classify-challenge] request received', { method: req.method });
  try {
    if (!ANTHROPIC_API_KEY) {
      console.error('[classify-challenge] ANTHROPIC_API_KEY not set');
      return jsonError(500, 'Server misconfigured: ANTHROPIC_API_KEY missing');
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch (parseErr) {
      return jsonError(400, 'Invalid JSON body', { details: String(parseErr) });
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const category = typeof body.category === 'string' ? body.category.trim() : '';

    if (!title) {
      return jsonError(400, 'Missing required field: title');
    }

    const userMessage = [
      `Title: "${title}"`,
      description ? `Description: "${description}"` : null,
      category ? `Category: ${category}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    console.log('[classify-challenge] calling Claude', { title, hasDesc: !!description });

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: CLASSIFIER_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!anthropicResponse.ok) {
      const errBody = await anthropicResponse.text();
      console.error('[classify-challenge] Anthropic API error', anthropicResponse.status, errBody);
      return jsonError(502, `Classifier service error (${anthropicResponse.status})`, {
        details: errBody.slice(0, 500),
      });
    }

    const aiData = await anthropicResponse.json();
    const aiText: string = aiData.content?.[0]?.text ?? '{}';
    console.log('[classify-challenge] Claude raw response', aiText);

    const cleaned = aiText.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[classify-challenge] JSON parse failed', parseErr);
      return jsonError(502, 'Classifier returned invalid JSON', {
        raw: aiText.slice(0, 300),
      });
    }

    // ── Validate proof_class ──
    const rawClass = parsed.proof_class;
    if (typeof rawClass !== 'string' || !ALLOWED_CLASSES.includes(rawClass as ProofClass)) {
      return jsonError(502, 'Classifier returned invalid proof_class', { raw: parsed });
    }
    const proof_class = rawClass as ProofClass;

    // ── Sanitize verification_policy ──
    const rawPolicy = (parsed.verification_policy ?? {}) as Record<string, unknown>;

    const sanitizeMethods = (input: unknown): VerificationMethod[] => {
      if (!Array.isArray(input)) return [];
      const out: VerificationMethod[] = [];
      for (const m of input) {
        if (typeof m === 'string' && ALLOWED_METHODS.includes(m as VerificationMethod)) {
          if (!out.includes(m as VerificationMethod)) out.push(m as VerificationMethod);
        }
      }
      return out;
    };

    let allowed_methods = sanitizeMethods(rawPolicy.allowed_methods);
    let hard_block_methods = sanitizeMethods(rawPolicy.hard_block_methods);

    // ── Enforce invariants (defense against classifier drift) ──
    // "high" MUST block photo_ai and allow healthkit.
    if (proof_class === 'high') {
      if (!hard_block_methods.includes('photo_ai')) hard_block_methods.push('photo_ai');
      if (!allowed_methods.includes('healthkit')) allowed_methods = ['healthkit'];
    }
    // "medium" MUST allow photo_ai and MUST NOT block it.
    if (proof_class === 'medium') {
      hard_block_methods = hard_block_methods.filter((m) => m !== 'photo_ai');
      if (!allowed_methods.includes('photo_ai')) allowed_methods = ['photo_ai'];
    }
    // "low" invariant: if healthkit is in allowed_methods, photo_ai must be
    // hard-blocked (HealthKit path available → force it). If only photo_ai
    // is allowed, leave hard_block empty (honor-system fallback).
    if (proof_class === 'low') {
      if (allowed_methods.includes('healthkit') && !hard_block_methods.includes('photo_ai')) {
        hard_block_methods.push('photo_ai');
      }
      if (allowed_methods.length === 0) {
        // Classifier left it empty — default to photo_ai fallback.
        allowed_methods = ['photo_ai'];
        hard_block_methods = [];
      }
    }

    // Remove any method that appears in both allowed and hard_block — block wins.
    allowed_methods = allowed_methods.filter((m) => !hard_block_methods.includes(m));

    const min_evidence_count =
      typeof rawPolicy.min_evidence_count === 'number' && rawPolicy.min_evidence_count > 0
        ? Math.min(Math.max(Math.floor(rawPolicy.min_evidence_count), 1), 10)
        : proof_class === 'low' && !hard_block_methods.includes('photo_ai')
          ? 3
          : 1;

    const time_window_hours =
      typeof rawPolicy.time_window_hours === 'number' && rawPolicy.time_window_hours > 0
        ? Math.min(Math.max(Math.floor(rawPolicy.time_window_hours), 1), 168)
        : 24;

    // ── recommended_method: must be in allowed_methods ──
    let recommended_method: VerificationMethod;
    const rawRecommended = parsed.recommended_method;
    if (
      typeof rawRecommended === 'string' &&
      ALLOWED_METHODS.includes(rawRecommended as VerificationMethod) &&
      allowed_methods.includes(rawRecommended as VerificationMethod)
    ) {
      recommended_method = rawRecommended as VerificationMethod;
    } else {
      recommended_method = allowed_methods[0] ?? 'photo_ai';
    }

    const reasoning =
      typeof parsed.reasoning === 'string' ? parsed.reasoning.slice(0, 300) : '';

    const result = {
      proof_class,
      recommended_method,
      verification_policy: {
        allowed_methods,
        hard_block_methods,
        min_evidence_count,
        time_window_hours,
      },
      reasoning,
    };

    console.log('[classify-challenge] result', result);
    return new Response(JSON.stringify(result), { headers: JSON_HEADERS });
  } catch (error) {
    console.error('[classify-challenge] uncaught error', error);
    return jsonError(500, 'Classification failed', { details: String(error) });
  }
});
