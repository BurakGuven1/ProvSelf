-- ============================================================
-- Migration: Duo Challenges + Weekly Progress Support
-- ============================================================
-- Adds:
-- 1) Duo metadata columns on challenges
-- 2) duo_challenge_requests table for invite/accept flow
-- 3) RLS policies so accountability partners can read each other's
--    duo challenge progress and proofs
-- 4) SECURITY DEFINER RPC to atomically accept a duo request

ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS challenge_mode TEXT NOT NULL DEFAULT 'solo'
    CHECK (challenge_mode IN ('solo', 'duo'));

ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS accountability_partner_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS duo_link_id UUID;

CREATE INDEX IF NOT EXISTS idx_challenges_accountability_partner
  ON challenges(accountability_partner_id);

CREATE INDEX IF NOT EXISTS idx_challenges_duo_link
  ON challenges(duo_link_id);

CREATE TABLE IF NOT EXISTS duo_challenge_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  inviter_challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  invitee_challenge_id UUID REFERENCES challenges(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  frequency TEXT NOT NULL,
  duration_days INT NOT NULL CHECK (duration_days > 0),
  required_completions INT NOT NULL CHECK (required_completions > 0),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  stake_cents INT NOT NULL CHECK (stake_cents > 0),
  verification_type TEXT NOT NULL,
  verification_config JSONB,
  proof_class TEXT,
  verification_policy JSONB,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT duo_request_distinct_users CHECK (inviter_id <> invitee_id)
);

CREATE INDEX IF NOT EXISTS idx_duo_requests_invitee_status
  ON duo_challenge_requests(invitee_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_duo_requests_inviter_status
  ON duo_challenge_requests(inviter_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_duo_requests_one_pending_per_challenge
  ON duo_challenge_requests(inviter_challenge_id)
  WHERE status = 'pending';

ALTER TABLE duo_challenge_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'duo_challenge_requests'
      AND policyname = 'Read own duo requests'
  ) THEN
    CREATE POLICY "Read own duo requests"
      ON duo_challenge_requests
      FOR SELECT
      USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'duo_challenge_requests'
      AND policyname = 'Insert duo request by inviter'
  ) THEN
    CREATE POLICY "Insert duo request by inviter"
      ON duo_challenge_requests
      FOR INSERT
      WITH CHECK (
        auth.uid() = inviter_id
        AND EXISTS (
          SELECT 1
          FROM challenges c
          WHERE c.id = inviter_challenge_id
            AND c.user_id = auth.uid()
        )
        AND EXISTS (
          SELECT 1
          FROM buddy_pairs bp
          WHERE bp.status = 'active'
            AND (
              (bp.user_id = inviter_id AND bp.buddy_id = invitee_id)
              OR
              (bp.user_id = invitee_id AND bp.buddy_id = inviter_id)
            )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'duo_challenge_requests'
      AND policyname = 'Invitee updates duo request'
  ) THEN
    CREATE POLICY "Invitee updates duo request"
      ON duo_challenge_requests
      FOR UPDATE
      USING (auth.uid() = invitee_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'duo_challenge_requests'
      AND policyname = 'Inviter can cancel pending duo request'
  ) THEN
    CREATE POLICY "Inviter can cancel pending duo request"
      ON duo_challenge_requests
      FOR UPDATE
      USING (auth.uid() = inviter_id AND status = 'pending');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'challenges'
      AND policyname = 'Read duo partner challenges'
  ) THEN
    CREATE POLICY "Read duo partner challenges"
      ON challenges
      FOR SELECT
      USING (
        challenge_mode = 'duo'
        AND accountability_partner_id = auth.uid()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_proofs'
      AND policyname = 'Read duo partner proofs'
  ) THEN
    CREATE POLICY "Read duo partner proofs"
      ON daily_proofs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM challenges c
          WHERE c.id = daily_proofs.challenge_id
            AND c.challenge_mode = 'duo'
            AND c.accountability_partner_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION accept_duo_challenge_request(p_request_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request duo_challenge_requests%ROWTYPE;
  v_user_id UUID;
  v_new_challenge_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO v_request
  FROM duo_challenge_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Duo request not found';
  END IF;

  IF v_request.invitee_id <> v_user_id THEN
    RAISE EXCEPTION 'Not authorized for this request';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Duo request is not pending';
  END IF;

  PERFORM deduct_stake(v_user_id, v_request.stake_cents);

  INSERT INTO challenges (
    user_id,
    title,
    description,
    category,
    frequency,
    duration_days,
    required_completions,
    start_date,
    end_date,
    stake_cents,
    verification_type,
    verification_config,
    proof_class,
    verification_policy,
    status,
    completed_days,
    failed_days,
    challenge_mode,
    accountability_partner_id,
    duo_link_id,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    v_request.title,
    v_request.description,
    v_request.category,
    v_request.frequency,
    v_request.duration_days,
    v_request.required_completions,
    v_request.start_date,
    v_request.end_date,
    v_request.stake_cents,
    v_request.verification_type,
    v_request.verification_config,
    v_request.proof_class,
    v_request.verification_policy,
    'active',
    0,
    0,
    'duo',
    v_request.inviter_id,
    v_request.id,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_new_challenge_id;

  UPDATE duo_challenge_requests
  SET
    status = 'accepted',
    invitee_challenge_id = v_new_challenge_id,
    responded_at = NOW()
  WHERE id = v_request.id;

  UPDATE challenges
  SET
    challenge_mode = 'duo',
    accountability_partner_id = v_request.invitee_id,
    duo_link_id = v_request.id,
    updated_at = NOW()
  WHERE id = v_request.inviter_challenge_id
    AND user_id = v_request.inviter_id;

  RETURN v_new_challenge_id;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_duo_challenge_request(UUID) TO authenticated;

