-- ============================================================
-- Migration: Manual no-proof day penalty
-- ============================================================
-- Adds a running penalty bucket on challenges for "approve without proof"
-- days. Penalty is applied against final returned stake at settlement.
--
-- Also adds UPDATE policy for daily_proofs so upsert/retry flows can
-- overwrite same-day proof rows owned by the current user.

ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS manual_override_penalty_cents INT NOT NULL DEFAULT 0
    CHECK (manual_override_penalty_cents >= 0);

COMMENT ON COLUMN challenges.manual_override_penalty_cents IS
  'Cumulative token penalty from manual no-proof day approvals. Applied against final returned stake.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_proofs'
      AND policyname = 'Update own proofs'
  ) THEN
    CREATE POLICY "Update own proofs"
      ON daily_proofs
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;
