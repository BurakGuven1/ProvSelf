// Supabase Edge Function: verify-photo
// Calls Claude Vision API to verify challenge proof photos.
//
// Accepts EITHER:
//   - photo_base64 + photo_media_type   (preferred — newest client)
//   - photo_url                          (legacy — older TestFlight builds
//                                         that uploaded to Supabase storage)
//
// This dual-mode keeps older installed builds working while we ship new ones.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Soft-pass threshold: a "verified: false" from the model is only honored as
// a hard fail when the model's confidence is at or above this value. Below
// the threshold we treat the result as a borderline pass.
const HARD_FAIL_CONFIDENCE = 0.85;

function normalizeMediaType(contentType: string | null | undefined): string {
  if (!contentType) return 'image/jpeg';
  const lower = contentType.toLowerCase().split(';')[0].trim();
  if (lower === 'image/jpg') return 'image/jpeg';
  if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(lower)) return lower;
  return 'image/jpeg';
}

// Policy enforcement is driven by proof_class + verification_policy stored
// on the challenge row at create time (see classify-challenge edge
// function). The previous per-language hydration/abstinence regexes have
// been removed — the classifier handles all 11 supported locales (and any
// other natural language) without per-language pattern maintenance. Legacy
// NULL rows fall through to the lenient AI verifier path.

interface ChallengePolicySnapshot {
  verification_type: 'healthkit' | 'photo_ai' | 'buddy_verify' | null;
  proof_class: 'high' | 'medium' | 'low' | null;
  verification_policy:
    | {
        allowed_methods?: string[];
        hard_block_methods?: string[];
      }
    | null;
}

async function fetchChallengePolicy(
  challengeId: string,
): Promise<ChallengePolicySnapshot | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[verify-photo] Supabase env not set — skipping policy lookup');
    return null;
  }
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase
      .from('challenges')
      .select('verification_type, proof_class, verification_policy')
      .eq('id', challengeId)
      .maybeSingle();
    if (error) {
      console.error('[verify-photo] policy lookup failed', error);
      return null;
    }
    return (data ?? null) as ChallengePolicySnapshot | null;
  } catch (err) {
    console.error('[verify-photo] policy lookup threw', err);
    return null;
  }
}

// Returns true if the challenge's stored policy hard-blocks photo_ai
// verification. Returns false if policy is NULL (legacy row) — caller
// falls through to normal verification in that case.
//
// IMPORTANT: do NOT short-circuit on `verification_type === 'photo_ai'`.
// The user can change verification_type from the challenge detail screen,
// and that field is decoupled from the immutable proof_class snapshot
// taken at create time. The policy is the source of truth.
function policyBlocksPhoto(snapshot: ChallengePolicySnapshot | null): boolean {
  if (!snapshot) return false;

  const hardBlock = snapshot.verification_policy?.hard_block_methods;
  if (Array.isArray(hardBlock) && hardBlock.includes('photo_ai')) {
    return true;
  }

  // High-proof challenges (HealthKit-only) should never accept photo
  // verification, even if the stored policy JSON is malformed/missing.
  if (snapshot.proof_class === 'high') {
    return true;
  }

  // proof_class === 'low' without an explicit hard_block means the
  // classifier deliberately allowed photo_ai as an honor-system fallback,
  // so do NOT block in that case.
  return false;
}

serve(async (req: Request) => {
  console.log('[verify-photo] request received', { method: req.method });
  try {
    if (!ANTHROPIC_API_KEY) {
      console.error('[verify-photo] ANTHROPIC_API_KEY not set in env');
      return new Response(
        JSON.stringify({ error: 'Server misconfigured: ANTHROPIC_API_KEY missing' }),
        { status: 500, headers: JSON_HEADERS },
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error('[verify-photo] body parse failed', parseErr);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body', details: String(parseErr) }),
        { status: 400, headers: JSON_HEADERS },
      );
    }

    // Log shape of the body so we can see exactly what each client sends.
    console.log('[verify-photo] body keys', Object.keys(body));

    const challenge_id = body.challenge_id as string | undefined;
    const challenge_title = body.challenge_title as string | undefined;
    const challenge_description = body.challenge_description as string | undefined;
    const photo_base64 = body.photo_base64 as string | undefined;
    const photo_media_type = body.photo_media_type as string | undefined;
    const photo_url = body.photo_url as string | undefined;
    const date = body.date as string | undefined;

    if (!challenge_title) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: challenge_title' }),
        { status: 400, headers: JSON_HEADERS },
      );
    }

    // Look up the immutable proof_class + verification_policy snapshot.
    // This single fetch drives both:
    //   1. The hard-block decision (policyBlocksPhoto)
    //   2. The "needs intentional selfie" strict-mode signal
    // Legacy NULL rows produce snapshot=null and fall through to the
    // standard lenient verifier with no abstinence guard.
    let policySnapshot: ChallengePolicySnapshot | null = null;
    if (challenge_id) {
      policySnapshot = await fetchChallengePolicy(challenge_id);
      if (policyBlocksPhoto(policySnapshot)) {
        return new Response(
          JSON.stringify({
            verified: false,
            confidence: 1,
            reasoning: 'Photo verification is blocked by this challenge policy.',
            trust_score: 0,
            missing_evidence: ['method_not_allowed'],
            retry_hint: 'Switch this challenge verification to Apple Health.',
            blocked: true,
            policy_code: 'photo_verification_blocked_by_policy',
            message:
              'This challenge does not allow photo verification. Please use the allowed verification method.',
          }),
          { status: 200, headers: JSON_HEADERS },
        );
      }
    }

    // Strict "selfie check-in required" mode is now derived from the
    // classifier: low proof_class + photo_ai allowed = behavioral /
    // abstinence challenge that needs intentional human evidence
    // (e.g. "no smoking", "no social media", "no sugar"). Language-
    // agnostic — works for every locale the classifier handles.
    const allowedMethods = policySnapshot?.verification_policy?.allowed_methods ?? [];
    const abstinenceChallenge =
      policySnapshot?.proof_class === 'low' &&
      Array.isArray(allowedMethods) &&
      allowedMethods.includes('photo_ai');

    let base64Image: string;
    let mediaType: string;

    if (photo_base64 && photo_base64.length > 0) {
      // ─── New path: client sent base64 inline ───
      base64Image = photo_base64;
      mediaType = normalizeMediaType(photo_media_type);
      console.log('[verify-photo] using inline base64', {
        base64Length: base64Image.length,
        mediaType,
      });
    } else if (photo_url) {
      // ─── Legacy path: fetch from storage ───
      console.log('[verify-photo] fetching photo from storage', photo_url);
      const imageResponse = await fetch(photo_url);
      if (!imageResponse.ok) {
        const body = await imageResponse.text();
        console.error('[verify-photo] photo fetch failed', imageResponse.status, body.slice(0, 200));
        return new Response(
          JSON.stringify({
            error: `Failed to fetch photo from storage (${imageResponse.status})`,
            details: body.slice(0, 200),
          }),
          { status: 400, headers: JSON_HEADERS },
        );
      }
      mediaType = normalizeMediaType(imageResponse.headers.get('content-type'));
      const imageBuffer = await imageResponse.arrayBuffer();
      console.log('[verify-photo] photo fetched', { bytes: imageBuffer.byteLength, mediaType });
      if (imageBuffer.byteLength === 0) {
        return new Response(
          JSON.stringify({ error: 'Fetched photo is empty (0 bytes). Upload may have failed.' }),
          { status: 400, headers: JSON_HEADERS },
        );
      }
      base64Image = encodeBase64(imageBuffer);
    } else {
      console.error('[verify-photo] neither photo_base64 nor photo_url provided');
      return new Response(
        JSON.stringify({ error: 'Missing photo: provide either photo_base64 or photo_url' }),
        { status: 400, headers: JSON_HEADERS },
      );
    }

    console.log('[verify-photo] calling Claude', {
      model: 'claude-haiku-4-5-20251001',
      base64Length: base64Image.length,
      mediaType,
    });

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: `This user has a daily challenge: "${challenge_title}"${challenge_description ? ` (${challenge_description})` : ''}. They submitted this photo as proof of EFFORT for today (${date}).

Your role: act as a LENIENT proof-of-effort verifier, not a strict judge. Real users sometimes capture awkward angles, partial views, low light, or post-activity scenes. Give them the benefit of the doubt whenever the photo is plausibly related to the challenge.

Mark as VERIFIED (true) when:
- The photo plausibly relates to the challenge, even loosely
- It looks like a real, recent capture (not an obvious stock or screenshot)
- There is no clear sign of fraud or manipulation

Mark as NOT VERIFIED (false) ONLY when one of these is clearly true:
- The photo is obviously unrelated to the challenge
- The photo is clearly a stock image, screenshot, or reused/old photo
- There are obvious signs of digital manipulation or fraud
- The image is blank, corrupted, or shows nothing recognizable

If you are unsure, lean toward VERIFIED. Use confidence to express how certain you are: only set confidence >= 0.85 when you are highly certain a rejection is correct. For borderline cases use confidence < 0.85.

When something is missing or could be improved, populate "missing_evidence" with short tags (e.g. "face_visible", "activity_in_frame", "context_recognizable", "lighting", "timestamp_visible") and write a single short, actionable "retry_hint" telling the user what to do next time. Keep retry_hint under 140 characters and phrase it positively (what to capture, not what they did wrong). If everything looks fine, return missing_evidence as an empty array and retry_hint as an empty string.

${abstinenceChallenge
  ? `Additional strict rule for abstinence challenges (no smoking/alcohol/sugar/etc):
- Do NOT accept object-only or empty-scene photos as proof.
- Require intentional human check-in: face should be visible in a live selfie and the image should look like a deliberate check-in (not random room/object).
- If face is not visible or image is object-only, reject with confidence >= 0.9.
`
  : ''}
Respond with JSON only: { "verified": true/false, "confidence": 0.0-1.0, "reasoning": "brief explanation", "missing_evidence": ["tag1", "tag2"], "retry_hint": "short actionable suggestion", "evidence_flags": { "face_visible": true/false, "intentional_checkin": true/false, "object_only": true/false } }`,
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const errBody = await anthropicResponse.text();
      console.error('[verify-photo] Anthropic API error', anthropicResponse.status, errBody);
      return new Response(
        JSON.stringify({
          error: `AI verification service error (${anthropicResponse.status})`,
          details: errBody,
        }),
        { status: 502, headers: JSON_HEADERS },
      );
    }

    const aiData = await anthropicResponse.json();
    const aiText = aiData.content?.[0]?.text ?? '{}';
    console.log('[verify-photo] Claude response text', aiText);

    const cleaned = aiText.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();

    let result: {
      verified?: boolean;
      confidence?: number;
      reasoning?: string;
      missing_evidence?: unknown;
      retry_hint?: unknown;
      evidence_flags?: unknown;
    };
    try {
      result = JSON.parse(cleaned);
    } catch {
      result = {
        verified: false,
        confidence: 0,
        reasoning: 'Could not parse AI response.',
        missing_evidence: [],
        retry_hint: '',
      };
    }

    // Abstinence challenges need intentional selfie check-in, otherwise
    // random object photos (e.g., empty table) can pass incorrectly.
    const flagsRaw =
      result.evidence_flags && typeof result.evidence_flags === 'object'
        ? (result.evidence_flags as Record<string, unknown>)
        : {};
    const faceVisible = flagsRaw.face_visible === true;
    const intentionalCheckin = flagsRaw.intentional_checkin === true;
    const objectOnly = flagsRaw.object_only === true;

    if (abstinenceChallenge && (!faceVisible || !intentionalCheckin || objectOnly)) {
      const rawMissing = Array.isArray(result.missing_evidence)
        ? (result.missing_evidence as unknown[]).filter((x): x is string => typeof x === 'string')
        : [];
      const requiredMissing: string[] = [];
      if (!faceVisible) requiredMissing.push('face_visible');
      if (!intentionalCheckin) requiredMissing.push('intentional_checkin');
      if (objectOnly) requiredMissing.push('human_present');

      result.verified = false;
      result.confidence = Math.max(
        typeof result.confidence === 'number' ? result.confidence : 0,
        0.9,
      );
      result.reasoning = 'Abstinence challenges require intentional selfie check-in evidence.';
      result.missing_evidence = Array.from(new Set([...rawMissing, ...requiredMissing]));
      if (typeof result.retry_hint !== 'string' || result.retry_hint.trim().length === 0) {
        result.retry_hint =
          'Capture a live selfie with your face visible and a quick intentional check-in cue.';
      }
      console.log('[verify-photo] abstinence guard hard-fail applied');
    }

    // ── Soft-pass / lenient post-processing ──
    // Only honor a "verified: false" verdict from the model when its
    // confidence is at or above HARD_FAIL_CONFIDENCE. Borderline rejections
    // are upgraded to a borderline pass — the user gets the benefit of the
    // doubt. Legacy fields (verified/confidence/reasoning) are preserved
    // exactly so old TestFlight clients keep working; the new fields
    // (trust_score, missing_evidence, retry_hint) are additive.
    const verifiedRaw = result.verified === true;
    const confidence = typeof result.confidence === 'number' ? result.confidence : 0;
    let verified = verifiedRaw;
    let reasoning = typeof result.reasoning === 'string' ? result.reasoning : '';
    let borderline = false;

    if (!verifiedRaw && confidence < HARD_FAIL_CONFIDENCE) {
      verified = true;
      borderline = true;
      reasoning = `${reasoning} [borderline accepted]`.trim();
      console.log('[verify-photo] borderline soft-pass applied', { confidence });
    }

    // Sanitize the new structured fields to predictable types.
    const missing_evidence = Array.isArray(result.missing_evidence)
      ? (result.missing_evidence as unknown[])
          .filter((x): x is string => typeof x === 'string')
          .slice(0, 8)
      : [];
    const retry_hint =
      typeof result.retry_hint === 'string' ? result.retry_hint.slice(0, 240) : '';

    // trust_score: deterministic, derived server-side (NOT from the model)
    // so the client never sees a value the model could manipulate.
    //   hard pass     → model's own confidence
    //   borderline    → fixed 0.5 (low-trust soft-pass)
    //   hard fail     → 0
    let trust_score: number;
    if (verified && !borderline) {
      trust_score = confidence;
    } else if (verified && borderline) {
      trust_score = 0.5;
    } else {
      trust_score = 0;
    }

    const finalResult = {
      // Legacy fields (do not rename or remove — old clients depend on these):
      verified,
      confidence,
      reasoning,
      // New additive fields (Phase 1.5-A):
      trust_score,
      missing_evidence,
      retry_hint,
      evidence_flags: {
        face_visible: faceVisible,
        intentional_checkin: intentionalCheckin,
        object_only: objectOnly,
      },
    };
    return new Response(JSON.stringify(finalResult), { headers: JSON_HEADERS });
  } catch (error) {
    console.error('[verify-photo] uncaught error', error);
    return new Response(
      JSON.stringify({ error: 'Verification failed', details: String(error) }),
      { status: 500, headers: JSON_HEADERS },
    );
  }
});
