export type RuleDifficulty = 'soft' | 'medium' | 'hard';

export interface FollowRuleItem {
  id: string;
  emoji: string;
  title: string;
  subtitle?: string;
  requiresPhoto?: boolean;
  tag?: 'fitness' | 'diet' | 'mindset' | 'hydration' | 'focus';
}

export interface FollowRulePack {
  id: RuleDifficulty;
  name: string;
  headline: string;
  createPreset: {
    title: string;
    description: string;
    category: 'fitness' | 'health' | 'productivity' | 'mindfulness' | 'custom';
    difficulty: 'easy' | 'medium' | 'hard';
    durationDays: number;
  };
  rules: FollowRuleItem[];
}

const FOLLOW_RULES: Record<RuleDifficulty, FollowRulePack> = {
  soft: {
    id: 'soft',
    name: 'Soft',
    headline: 'Build consistency with low-friction habits.',
    createPreset: {
      title: 'Follow The Rules - Soft',
      description:
        'Daily consistency mode: one workout, hydration, reading, and a short evening check-in.',
      category: 'mindfulness',
      difficulty: 'easy',
      durationDays: 30,
    },
    rules: [
      { id: 'soft_walk', emoji: '🚶', title: '20-minute walk' },
      { id: 'soft_water', emoji: '💧', title: 'Drink 2 liters of water', subtitle: 'About 8 glasses' },
      { id: 'soft_reading', emoji: '📘', title: 'Read 10 pages', subtitle: 'Any non-fiction topic' },
      { id: 'soft_note', emoji: '📝', title: 'Evening reflection', subtitle: 'Write one line about your day' },
      {
        id: 'soft_photo',
        emoji: '📸',
        title: 'Optional progress photo',
        subtitle: 'Keep visual momentum',
        requiresPhoto: true,
      },
    ],
  },
  medium: {
    id: 'medium',
    name: 'Medium',
    headline: 'Balanced challenge mode: effort + structure.',
    createPreset: {
      title: 'Follow The Rules - Medium',
      description:
        'Two-part daily structure: workout, hydration, clean eating discipline, and focused reading.',
      category: 'fitness',
      difficulty: 'medium',
      durationDays: 45,
    },
    rules: [
      { id: 'medium_workout', emoji: '🏋️', title: '45-minute workout' },
      { id: 'medium_outdoor', emoji: '🌤️', title: 'At least one outdoor session' },
      { id: 'medium_diet', emoji: '🥗', title: 'Follow your diet plan' },
      { id: 'medium_no_cheat', emoji: '🚫', title: 'No cheat meal today' },
      { id: 'medium_water', emoji: '🧴', title: 'Drink 3 liters of water' },
      { id: 'medium_reading', emoji: '📚', title: 'Read 10 pages non-fiction' },
      {
        id: 'medium_photo',
        emoji: '📷',
        title: 'Progress photo',
        subtitle: 'Daily body/posture snapshot',
        requiresPhoto: true,
      },
    ],
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    headline: 'No excuses mode. Zero negotiation.',
    createPreset: {
      title: 'Follow The Rules - Hard',
      description:
        'Two workouts daily, one outdoors, strict diet/no alcohol, high hydration, reading, and a progress photo.',
      category: 'fitness',
      difficulty: 'hard',
      durationDays: 75,
    },
    rules: [
      { id: 'hard_workout_1', emoji: '🏋️', title: 'First 45-minute workout' },
      { id: 'hard_workout_2', emoji: '🏃', title: 'Second 45-minute workout', subtitle: 'One must be outdoors' },
      { id: 'hard_diet', emoji: '🥕', title: 'Follow your nutrition protocol' },
      { id: 'hard_no_alcohol', emoji: '🍷', title: 'No alcohol / no cheat meals' },
      { id: 'hard_water', emoji: '🚰', title: 'Drink 1 gallon of water', subtitle: '3.7 liters' },
      { id: 'hard_reading', emoji: '📖', title: 'Read 10 pages non-fiction', subtitle: 'Audio does not count' },
      {
        id: 'hard_photo',
        emoji: '📸',
        title: 'Take a progress photo',
        requiresPhoto: true,
      },
    ],
  },
};

export function getFollowRulePack(difficulty: RuleDifficulty): FollowRulePack {
  return FOLLOW_RULES[difficulty];
}

export function getAllFollowRulePacks(): FollowRulePack[] {
  return [FOLLOW_RULES.soft, FOLLOW_RULES.medium, FOLLOW_RULES.hard];
}

