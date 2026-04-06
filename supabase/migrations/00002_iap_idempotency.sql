-- ============================================================
-- Migration: IAP Idempotency & Atomic Stake Operations
-- ============================================================

-- 1. Unique index on revenue_cat_transaction_id to prevent duplicate webhook processing
CREATE UNIQUE INDEX IF NOT EXISTS idx_stake_purchases_rc_txn
ON stake_purchases(revenue_cat_transaction_id)
WHERE revenue_cat_transaction_id IS NOT NULL;

-- 2. Unique constraint on stake_balances.user_id for upsert support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stake_balances_user_id_unique'
  ) THEN
    ALTER TABLE stake_balances ADD CONSTRAINT stake_balances_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- 3. Block client-side INSERT on stake_purchases (only service role / edge functions can insert)
CREATE POLICY "Block client insert on purchases"
ON stake_purchases FOR INSERT
WITH CHECK (false);

-- 4. Atomic stake deduction — prevents race conditions and double-spend
CREATE OR REPLACE FUNCTION deduct_stake(p_user_id UUID, p_amount INT)
RETURNS INT AS $$
DECLARE
  new_balance INT;
BEGIN
  UPDATE stake_balances
  SET balance_cents = balance_cents - p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND balance_cents >= p_amount
  RETURNING balance_cents INTO new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Atomic credit stake — idempotent via unique transaction_id
CREATE OR REPLACE FUNCTION credit_stake(
  p_user_id UUID,
  p_amount INT,
  p_transaction_id TEXT,
  p_product_id TEXT
)
RETURNS VOID AS $$
BEGIN
  -- Insert purchase record (fails on duplicate transaction_id — idempotency)
  INSERT INTO stake_purchases (user_id, amount_cents, revenue_cat_transaction_id, product_id, status)
  VALUES (p_user_id, p_amount, p_transaction_id, p_product_id, 'completed');

  -- Upsert balance — atomic increment
  INSERT INTO stake_balances (user_id, balance_cents, total_purchased_cents)
  VALUES (p_user_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET balance_cents = stake_balances.balance_cents + EXCLUDED.balance_cents,
      total_purchased_cents = stake_balances.total_purchased_cents + EXCLUDED.total_purchased_cents,
      updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
