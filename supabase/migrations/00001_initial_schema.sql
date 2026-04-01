-- Provself Initial Schema
-- Run this in Supabase SQL Editor

-- Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  locale TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  total_challenges INT DEFAULT 0,
  total_wins INT DEFAULT 0,
  total_losses INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  total_staked_cents INT DEFAULT 0,
  total_lost_cents INT DEFAULT 0,
  xp INT DEFAULT 0,
  level INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stake balances
CREATE TABLE stake_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  balance_cents INT DEFAULT 0,
  total_purchased_cents INT DEFAULT 0,
  total_returned_cents INT DEFAULT 0,
  total_forfeited_cents INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stake purchase history
CREATE TABLE stake_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL,
  revenue_cat_transaction_id TEXT,
  apple_transaction_id TEXT,
  product_id TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Challenges
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  frequency TEXT NOT NULL,
  duration_days INT NOT NULL,
  required_completions INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  stake_cents INT NOT NULL,
  verification_type TEXT NOT NULL,
  verification_config JSONB,
  status TEXT DEFAULT 'active',
  completed_days INT DEFAULT 0,
  failed_days INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily proofs
CREATE TABLE daily_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  proof_date DATE NOT NULL,
  verification_type TEXT NOT NULL,
  proof_data JSONB,
  photo_url TEXT,
  ai_verification_result BOOLEAN,
  ai_verification_reasoning TEXT,
  buddy_id UUID REFERENCES profiles(id),
  buddy_verified BOOLEAN,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(challenge_id, proof_date)
);

-- Buddy pairs
CREATE TABLE buddy_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  buddy_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, buddy_id)
);

-- Coach messages
CREATE TABLE coach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id UUID REFERENCES challenges(id),
  message_type TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Badges
CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon_name TEXT NOT NULL,
  requirement_type TEXT NOT NULL,
  requirement_value INT NOT NULL,
  xp_reward INT DEFAULT 0
);

CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id UUID REFERENCES badges(id),
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- Storage bucket for proof photos
INSERT INTO storage.buckets (id, name, public) VALUES ('proof-photos', 'proof-photos', true)
ON CONFLICT DO NOTHING;

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stake_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE stake_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddy_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Profiles: read own + public for leaderboard, update own
CREATE POLICY "Public profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Stake balances
CREATE POLICY "Read own balance" ON stake_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Insert own balance" ON stake_balances FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own balance" ON stake_balances FOR UPDATE USING (auth.uid() = user_id);

-- Stake purchases
CREATE POLICY "Read own purchases" ON stake_purchases FOR SELECT USING (auth.uid() = user_id);

-- Challenges
CREATE POLICY "Read own challenges" ON challenges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Insert own challenges" ON challenges FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own challenges" ON challenges FOR UPDATE USING (auth.uid() = user_id);

-- Daily proofs
CREATE POLICY "Read own proofs" ON daily_proofs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Insert own proofs" ON daily_proofs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Buddy pairs
CREATE POLICY "Read own buddies" ON buddy_pairs FOR SELECT USING (auth.uid() = user_id OR auth.uid() = buddy_id);
CREATE POLICY "Insert buddy request" ON buddy_pairs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update buddy status" ON buddy_pairs FOR UPDATE USING (auth.uid() = buddy_id);

-- Coach messages
CREATE POLICY "Read own messages" ON coach_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Update own messages" ON coach_messages FOR UPDATE USING (auth.uid() = user_id);

-- Badges: public read
CREATE POLICY "Public badges" ON badges FOR SELECT USING (true);
CREATE POLICY "Read own user badges" ON user_badges FOR SELECT USING (auth.uid() = user_id);

-- Storage policies
CREATE POLICY "Users can upload proof photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'proof-photos' AND auth.role() = 'authenticated');
CREATE POLICY "Proof photos are public" ON storage.objects
  FOR SELECT USING (bucket_id = 'proof-photos');

-- Helper functions for edge functions
CREATE OR REPLACE FUNCTION increment_profile_stat(p_user_id UUID, p_column TEXT, p_value INT)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('UPDATE profiles SET %I = %I + $1, updated_at = NOW() WHERE id = $2', p_column, p_column)
  USING p_value, p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION return_stake(p_user_id UUID, p_amount INT)
RETURNS VOID AS $$
BEGIN
  UPDATE stake_balances
  SET balance_cents = balance_cents + p_amount,
      total_returned_cents = total_returned_cents + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION forfeit_stake(p_user_id UUID, p_amount INT)
RETURNS VOID AS $$
BEGIN
  UPDATE stake_balances
  SET total_forfeited_cents = total_forfeited_cents + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS VOID AS $$
BEGIN
  -- Since we read directly from profiles, this is a no-op placeholder
  -- Add materialized view refresh here if needed
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name, locale)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'username', NULL),
    'en'
  );
  INSERT INTO stake_balances (user_id, balance_cents)
  VALUES (NEW.id, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Seed default badges
INSERT INTO badges (name, description, icon_name, requirement_type, requirement_value, xp_reward) VALUES
  ('First Win', 'Complete your first challenge', 'trophy', 'total_wins', 1, 100),
  ('Five Timer', 'Complete 5 challenges', 'ribbon', 'total_wins', 5, 250),
  ('Streak Master', 'Reach a 7-day streak', 'flame', 'streak', 7, 200),
  ('Month Warrior', 'Reach a 30-day streak', 'shield', 'streak', 30, 500),
  ('High Roller', 'Stake over $100 total', 'cash', 'total_staked', 10000, 300),
  ('Fitness Freak', 'Win 5 fitness challenges', 'barbell', 'category_wins', 5, 250),
  ('Centurion', 'Reach a 100-day streak', 'star', 'streak', 100, 1000),
  ('Ten Wins', 'Complete 10 challenges', 'medal', 'total_wins', 10, 500)
ON CONFLICT DO NOTHING;
