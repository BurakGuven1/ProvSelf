import type { HealthKitVerificationConfig } from '@/src/types/database';

function normalizedChallengeText(title: string, description?: string | null): string {
  return `${title} ${description ?? ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Detect hydration challenges across major language variants.
// This is a fallback heuristic; the server-side classifier is the source
// of truth when available.
export function isHydrationChallenge(title: string, description?: string | null): boolean {
  const text = normalizedChallengeText(title, description);

  const patterns: RegExp[] = [
    // English
    /\bwater\b/,
    /\bhydrat(?:e|ion|ed|ing)?\b/,
    /\bglass(?:es)?\s+(?:of\s+)?water\b/,
    /\b8\s*glasses?\b.*\bwater\b/,
    /\b2\s*l\b/,
    /\b2\s*lit(?:er|re)s?\b/,
    /\bwater\s*intake\b/,
    // Turkish
    /\bsu\s*ic\b/,
    /\bhidrasyon\b/,
    /\bbardak\s*su\b/,
    /\blitre\s*su\b/,
    // German / Spanish / Portuguese / French / Italian (normalized)
    /\bwasser\b/,
    /\bagua\b/,
    /\beau\b/,
    /\bacqua\b/,
    /\bhidratacion\b/,
    /\bhidratacao\b/,
    /\bidratazione\b/,
  ];

  return patterns.some((rx) => rx.test(text));
}

// Negative / abstinence habits are not visually provable from a random object
// photo. For these, photo proof must act as intentional selfie check-in.
export function isAbstinenceChallenge(title: string, description?: string | null): boolean {
  const text = normalizedChallengeText(title, description);
  const patterns: RegExp[] = [
    /\bno\s*(smok(?:e|ing)?|cigarette|nicotine|vape|alcohol|drinking|sugar|junk\s*food|social\s*media|porn)\b/,
    /\bquit\s*(smok(?:e|ing)?|cigarette|nicotine|vape|alcohol)\b/,
    /\bstop\s*(smok(?:e|ing)?|alcohol|drinking)\b/,
    /\bsigara\s*(icmeme|birak|yok)\b/,
    /\balkol\s*(yok|birak)\b/,
    /\bseker\s*(yok|birak)\b/,
    /\bzararli\s*yiyecek\s*yok\b/,
    /\bnikotin\s*yok\b/,
    /\bsmoke[-\s]*free\b/,
    /\balcohol[-\s]*free\b/,
    /\bsober\b/,
  ];
  return patterns.some((rx) => rx.test(text));
}

export function getHydrationHealthConfig(): HealthKitVerificationConfig {
  // 8 glasses/day ~= 2L ~= 2000ml
  return { metric: 'water_ml', target: 2000 };
}

export function getNoProofDayPenalty(stakeCents: number, durationDays: number): number {
  const safeStake = Math.max(0, Math.floor(stakeCents));
  const safeDuration = Math.max(1, Math.floor(durationDays));
  // Requested rule: daily penalty = (stake / duration) / 2 => stake / (duration * 2)
  return Math.max(1, Math.round(safeStake / (safeDuration * 2)));
}
