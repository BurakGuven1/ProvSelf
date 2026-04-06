export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  push_token: string | null;
  locale: 'en' | 'de' | 'fr' | 'ja' | 'zh' | 'pt-BR' | 'ru' | 'hi' | 'ko' | 'it' | 'es';
  timezone: string;
  total_challenges: number;
  total_wins: number;
  total_losses: number;
  current_streak: number;
  longest_streak: number;
  total_staked_cents: number;
  total_lost_cents: number;
  xp: number;
  level: number;
  created_at: string;
  updated_at: string;
}

export interface StakeBalance {
  id: string;
  user_id: string;
  balance_cents: number;
  total_purchased_cents: number;
  total_returned_cents: number;
  total_forfeited_cents: number;
  updated_at: string;
}

export interface StakePurchase {
  id: string;
  user_id: string;
  amount_cents: number;
  revenue_cat_transaction_id: string | null;
  apple_transaction_id: string | null;
  product_id: string;
  status: 'completed' | 'refunded';
  created_at: string;
}

export type ChallengeCategory = 'fitness' | 'health' | 'productivity' | 'mindfulness' | 'custom';
export type ChallengeDifficulty = 'easy' | 'medium' | 'hard';
export type ChallengeFrequency = 'daily' | 'weekly';
export type ChallengeStatus = 'active' | 'completed_success' | 'completed_fail' | 'cancelled';
export type VerificationType = 'healthkit' | 'photo_ai' | 'buddy_verify';

export interface HealthKitVerificationConfig {
  metric: string;
  target: number;
}

export interface PhotoVerificationConfig {
  description: string;
}

export type VerificationConfig = HealthKitVerificationConfig | PhotoVerificationConfig;

export interface Challenge {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: ChallengeCategory;
  frequency: ChallengeFrequency;
  duration_days: number;
  required_completions: number;
  start_date: string;
  end_date: string;
  stake_cents: number;
  verification_type: VerificationType;
  verification_config: VerificationConfig | null;
  status: ChallengeStatus;
  completed_days: number;
  failed_days: number;
  created_at: string;
  updated_at: string;
}

export interface DailyProof {
  id: string;
  challenge_id: string;
  user_id: string;
  proof_date: string;
  verification_type: VerificationType;
  proof_data: Record<string, unknown> | null;
  photo_url: string | null;
  ai_verification_result: boolean | null;
  ai_verification_reasoning: string | null;
  buddy_id: string | null;
  buddy_verified: boolean | null;
  is_verified: boolean;
  created_at: string;
}

export interface BuddyPair {
  id: string;
  user_id: string;
  buddy_id: string;
  status: 'pending' | 'active' | 'declined';
  created_at: string;
}

export interface CoachMessage {
  id: string;
  user_id: string;
  challenge_id: string | null;
  message_type: 'motivation' | 'reminder' | 'congrats' | 'warning' | 'streak';
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string | null;
  icon_name: string;
  requirement_type: 'streak' | 'total_wins' | 'total_staked' | 'category_wins';
  requirement_value: number;
  xp_reward: number;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  badge?: Badge;
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  current_streak: number;
  longest_streak: number;
  total_wins: number;
  xp: number;
  level: number;
  global_rank: number;
}
