-- ============================================================
-- Migration: Repair profile bootstrap and backfill missing rows
-- ============================================================

-- Build a unique, normalized username for a given auth user
CREATE OR REPLACE FUNCTION public.make_unique_username(p_base TEXT, p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  base_username TEXT;
  candidate TEXT;
  suffix_counter INT := 0;
BEGIN
  base_username := lower(regexp_replace(coalesce(trim(p_base), ''), '[^a-zA-Z0-9_]', '', 'g'));

  IF base_username = '' THEN
    base_username := 'user_' || substr(p_user_id::text, 1, 8);
  END IF;

  -- username min length guard
  IF length(base_username) < 3 THEN
    base_username := base_username || '_' || substr(p_user_id::text, 1, 3);
  END IF;

  candidate := left(base_username, 24);

  WHILE EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.username = candidate
      AND p.id <> p_user_id
  ) LOOP
    suffix_counter := suffix_counter + 1;
    candidate := left(base_username, 20) || '_' || lpad(suffix_counter::text, 3, '0');
  END LOOP;

  RETURN candidate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function: create profile + stake row on new auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  resolved_username TEXT;
BEGIN
  resolved_username := public.make_unique_username(
    COALESCE(NEW.raw_user_meta_data->>'username', ''),
    NEW.id
  );

  INSERT INTO public.profiles (id, username, display_name, locale, timezone)
  VALUES (
    NEW.id,
    resolved_username,
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'locale', ''), 'en'),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'timezone', ''), 'UTC')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.stake_balances (user_id, balance_cents, total_purchased_cents, total_returned_cents, total_forfeited_cents)
  VALUES (NEW.id, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger safely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill missing profile rows for existing auth users
INSERT INTO public.profiles (id, username, display_name, locale, timezone, created_at, updated_at)
SELECT
  u.id,
  public.make_unique_username(COALESCE(u.raw_user_meta_data->>'username', ''), u.id),
  NULLIF(u.raw_user_meta_data->>'username', ''),
  COALESCE(NULLIF(u.raw_user_meta_data->>'locale', ''), 'en'),
  COALESCE(NULLIF(u.raw_user_meta_data->>'timezone', ''), 'UTC'),
  NOW(),
  NOW()
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Backfill missing stake balance rows
INSERT INTO public.stake_balances (user_id, balance_cents, total_purchased_cents, total_returned_cents, total_forfeited_cents, updated_at)
SELECT
  p.id,
  0,
  0,
  0,
  0,
  NOW()
FROM public.profiles p
LEFT JOIN public.stake_balances sb ON sb.user_id = p.id
WHERE sb.user_id IS NULL;
