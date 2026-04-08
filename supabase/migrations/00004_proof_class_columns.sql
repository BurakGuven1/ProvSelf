-- ============================================================
-- Migration: Proof Classification columns (additive, non-breaking)
-- ============================================================
-- Adds proof_class + verification_policy columns to the challenges
-- table. Both are NULLABLE so existing rows (and existing TestFlight
-- clients that don't know about these columns yet) are unaffected.
--
-- Phase 1.5-B will introduce a classify-challenge edge function
-- that populates these at challenge creation time. Until then,
-- NULL means "unclassified — fall back to legacy verification_type
-- behavior".

ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS proof_class TEXT
    CHECK (proof_class IN ('high', 'medium', 'low'));

ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS verification_policy JSONB;

-- Partial index — only indexes non-null rows so the index stays
-- small while we backfill. Useful for future queries that filter
-- by proof class (e.g. "show all low-proof challenges").
CREATE INDEX IF NOT EXISTS idx_challenges_proof_class
  ON challenges(proof_class)
  WHERE proof_class IS NOT NULL;

COMMENT ON COLUMN challenges.proof_class IS
  'high = sensor-measurable (HealthKit), medium = single-photo proof acceptable, low = needs HealthKit/multi-checkin/buddy. NULL = unclassified (legacy rows).';

COMMENT ON COLUMN challenges.verification_policy IS
  'JSONB snapshot of the verification policy derived at create time. Shape: { allowed_methods: string[], hard_block_methods: string[], min_evidence_count: number, time_window_hours: number }. NULL for legacy rows.';
