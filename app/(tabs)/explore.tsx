import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import Card from '@/src/components/Card';
import type { ChallengeDifficulty } from '@/src/types/database';

// ── Types ──
interface ChallengeTemplate {
  id: string;
  title: string;
  category: string;
  icon: keyof typeof Ionicons.glyphMap;
  metric?: string;
  target?: number;
  description: string;
  difficulty: ChallengeDifficulty;
  defaultDuration: number; // days
  frequency?: 'daily' | 'weekly';
  suggestedStake: number; // tokens
}

// ── Stake calculation (mirrors challenge/create.tsx) ──
const BASE_STAKE: Record<number, number> = {
  7: 100,
  14: 200,
  30: 500,
  90: 1500,
  180: 3000,
  365: 5000,
};

const DIFFICULTY_MULTIPLIER: Record<ChallengeDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 4,
};

function calcStake(days: number, diff: ChallengeDifficulty): number {
  const base = BASE_STAKE[days] ?? 100;
  return base * DIFFICULTY_MULTIPLIER[diff];
}

// ── Duration labels ──
function durationLabel(days: number): string {
  if (days <= 7) return '1 Week';
  if (days <= 14) return '2 Weeks';
  if (days <= 30) return '1 Month';
  if (days <= 90) return '3 Months';
  if (days <= 180) return '6 Months';
  return '1 Year';
}

// ── Pre-made Templates ──
// Organized by difficulty x duration matrix
const TEMPLATES: ChallengeTemplate[] = [
  // ─── EASY + SHORT (7 days) ───
  {
    id: 'e1',
    title: 'Drink 8 Glasses of Water',
    category: 'health',
    icon: 'water',
    metric: 'water_ml',
    target: 2000,
    description: 'Stay hydrated — drink at least 8 glasses of water daily.',
    difficulty: 'easy',
    defaultDuration: 7,
    suggestedStake: calcStake(7, 'easy'), // 100
  },
  {
    id: 'e2',
    title: '7 Hours of Sleep',
    category: 'health',
    icon: 'moon',
    metric: 'sleep_hours',
    target: 7,
    description: 'Get at least 7 hours of sleep every night.',
    difficulty: 'easy',
    defaultDuration: 7,
    suggestedStake: calcStake(7, 'easy'), // 100
  },
  {
    id: 'e3',
    title: '10-Minute Walk',
    category: 'fitness',
    icon: 'footsteps',
    metric: 'exercise_minutes',
    target: 10,
    description: 'Take a 10-minute walk every day.',
    difficulty: 'easy',
    defaultDuration: 7,
    suggestedStake: calcStake(7, 'easy'), // 100
  },
  // ─── EASY + MEDIUM (14-30 days) ───
  {
    id: 'e4',
    title: 'Healthy Breakfast',
    category: 'health',
    icon: 'nutrition',
    description: 'Eat a healthy breakfast every morning.',
    difficulty: 'easy',
    defaultDuration: 14,
    suggestedStake: calcStake(14, 'easy'), // 200
  },
  {
    id: 'e5',
    title: 'Meditate 10 Minutes',
    category: 'mindfulness',
    icon: 'leaf',
    description: 'Practice 10 minutes of meditation or mindfulness daily.',
    difficulty: 'easy',
    defaultDuration: 30,
    suggestedStake: calcStake(30, 'easy'), // 500
  },
  {
    id: 'e6',
    title: 'Read 15 Minutes',
    category: 'productivity',
    icon: 'book',
    description: 'Read for at least 15 minutes before bed.',
    difficulty: 'easy',
    defaultDuration: 30,
    suggestedStake: calcStake(30, 'easy'), // 500
  },
  // ─── EASY + LONG (90+ days) ───
  {
    id: 'e7',
    title: 'Daily Gratitude Journal',
    category: 'mindfulness',
    icon: 'journal',
    description: 'Write 3 things you are grateful for each day.',
    difficulty: 'easy',
    defaultDuration: 90,
    suggestedStake: calcStake(90, 'easy'), // 1500
  },
  {
    id: 'e8',
    title: 'Consistent Sleep Schedule',
    category: 'health',
    icon: 'moon',
    metric: 'sleep_hours',
    target: 7,
    description: 'Go to bed and wake up at the same time every day.',
    difficulty: 'easy',
    defaultDuration: 90,
    suggestedStake: calcStake(90, 'easy'), // 1500
  },

  // ─── MEDIUM + SHORT (7 days) ───
  {
    id: 'm1',
    title: '10,000 Steps Daily',
    category: 'fitness',
    icon: 'footsteps',
    metric: 'steps',
    target: 10000,
    description: 'Walk at least 10,000 steps every day.',
    difficulty: 'medium',
    defaultDuration: 7,
    suggestedStake: calcStake(7, 'medium'), // 200
  },
  {
    id: 'm2',
    title: 'No Junk Food',
    category: 'health',
    icon: 'close-circle',
    description: 'Avoid all junk food and processed snacks.',
    difficulty: 'medium',
    defaultDuration: 7,
    suggestedStake: calcStake(7, 'medium'), // 200
  },
  // ─── MEDIUM + MEDIUM (14-30 days) ───
  {
    id: 'm3',
    title: '30 Min Exercise Daily',
    category: 'fitness',
    icon: 'barbell',
    metric: 'exercise_minutes',
    target: 30,
    description: 'Exercise for at least 30 minutes each day.',
    difficulty: 'medium',
    defaultDuration: 30,
    suggestedStake: calcStake(30, 'medium'), // 1000
  },
  {
    id: 'm4',
    title: 'Morning Routine Before 8 AM',
    category: 'mindfulness',
    icon: 'sunny',
    description: 'Complete your morning routine before 8 AM every day.',
    difficulty: 'medium',
    defaultDuration: 30,
    suggestedStake: calcStake(30, 'medium'), // 1000
  },
  {
    id: 'm5',
    title: 'No Sugar for 2 Weeks',
    category: 'health',
    icon: 'ban',
    description: 'Cut out all added sugar from your diet.',
    difficulty: 'medium',
    defaultDuration: 14,
    suggestedStake: calcStake(14, 'medium'), // 400
  },
  {
    id: 'm6',
    title: 'Read 30 Minutes Daily',
    category: 'productivity',
    icon: 'book',
    description: 'Read for at least 30 minutes every day.',
    difficulty: 'medium',
    defaultDuration: 30,
    suggestedStake: calcStake(30, 'medium'), // 1000
  },
  // ─── MEDIUM + LONG (90+ days) ───
  {
    id: 'm7',
    title: '10,000 Steps (3 Months)',
    category: 'fitness',
    icon: 'footsteps',
    metric: 'steps',
    target: 10000,
    description: 'Walk 10,000 steps daily for 3 full months.',
    difficulty: 'medium',
    defaultDuration: 90,
    suggestedStake: calcStake(84, 'medium'),
  },
  {
    id: 'm8',
    title: 'Gym 3x/Week',
    category: 'fitness',
    icon: 'fitness',
    description: 'Go to the gym at least 3 times per week.',
    difficulty: 'medium',
    defaultDuration: 84,
    frequency: 'weekly',
    suggestedStake: calcStake(90, 'medium'), // 3000
  },

  // ─── HARD + SHORT (7 days) ───
  {
    id: 'h1',
    title: 'No Smoking (1 Week)',
    category: 'health',
    icon: 'ban',
    description: 'Quit smoking completely for 7 days.',
    difficulty: 'hard',
    defaultDuration: 7,
    suggestedStake: calcStake(7, 'hard'), // 400
  },
  {
    id: 'h2',
    title: 'No Social Media',
    category: 'productivity',
    icon: 'phone-portrait-outline',
    description: 'Stay off all social media platforms.',
    difficulty: 'hard',
    defaultDuration: 7,
    suggestedStake: calcStake(7, 'hard'), // 400
  },
  {
    id: 'h3',
    title: 'Wake Up at 5 AM',
    category: 'productivity',
    icon: 'alarm',
    description: 'Wake up at 5 AM every single day.',
    difficulty: 'hard',
    defaultDuration: 7,
    suggestedStake: calcStake(7, 'hard'), // 400
  },
  // ─── HARD + MEDIUM (14-30 days) ───
  {
    id: 'h4',
    title: 'No Smoking (1 Month)',
    category: 'health',
    icon: 'ban',
    description: 'Quit smoking for a full month. A life-changing challenge.',
    difficulty: 'hard',
    defaultDuration: 30,
    suggestedStake: calcStake(30, 'hard'), // 2000
  },
  {
    id: 'h5',
    title: 'Burn 500 Calories Daily',
    category: 'fitness',
    icon: 'flame',
    metric: 'active_calories',
    target: 500,
    description: 'Burn at least 500 active calories every day for 2 weeks.',
    difficulty: 'hard',
    defaultDuration: 14,
    suggestedStake: calcStake(14, 'hard'), // 800
  },
  {
    id: 'h6',
    title: 'Cold Shower Every Day',
    category: 'health',
    icon: 'snow',
    description: 'Take a cold shower every morning for mental toughness.',
    difficulty: 'hard',
    defaultDuration: 30,
    suggestedStake: calcStake(30, 'hard'), // 2000
  },
  {
    id: 'h7',
    title: 'No Social Media (1 Month)',
    category: 'productivity',
    icon: 'phone-portrait-outline',
    description: 'Complete digital detox — no social media for 30 days.',
    difficulty: 'hard',
    defaultDuration: 30,
    suggestedStake: calcStake(30, 'hard'), // 2000
  },
  // ─── HARD + LONG (90+ days) ───
  {
    id: 'h8',
    title: 'No Smoking (3 Months)',
    category: 'health',
    icon: 'ban',
    description: 'Quit smoking for 3 months. Prove you can break the habit for good.',
    difficulty: 'hard',
    defaultDuration: 90,
    suggestedStake: calcStake(90, 'hard'), // 6000
  },
  {
    id: 'h9',
    title: 'Run 5K Every Day',
    category: 'fitness',
    icon: 'walk',
    description: 'Run 5 kilometers every single day for 3 months.',
    difficulty: 'hard',
    defaultDuration: 90,
    suggestedStake: calcStake(90, 'hard'), // 6000
  },
  {
    id: 'h10',
    title: 'No Alcohol (6 Months)',
    category: 'health',
    icon: 'ban',
    description: 'Commit to zero alcohol for 6 months.',
    difficulty: 'hard',
    defaultDuration: 168,
    frequency: 'weekly',
    suggestedStake: calcStake(168, 'hard'),
  },
];

// ── Filter chips ──
const CATEGORIES = [
  { key: 'all', icon: 'grid' as const },
  { key: 'fitness', icon: 'barbell' as const },
  { key: 'health', icon: 'heart' as const },
  { key: 'productivity', icon: 'rocket' as const },
  { key: 'mindfulness', icon: 'leaf' as const },
];

const DIFFICULTY_FILTERS: { key: 'all' | ChallengeDifficulty; label: string; color: string }[] = [
  { key: 'all', label: 'All', color: colors.textPrimary },
  { key: 'easy', label: 'Easy', color: colors.success },
  { key: 'medium', label: 'Medium', color: colors.warning },
  { key: 'hard', label: 'Hard', color: colors.danger },
];

const DIFFICULTY_COLORS: Record<ChallengeDifficulty, string> = {
  easy: colors.success,
  medium: colors.warning,
  hard: colors.danger,
};

export default function ExploreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'all' | ChallengeDifficulty>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    return TEMPLATES.filter((tmpl) => {
      const matchesCategory = selectedCategory === 'all' || tmpl.category === selectedCategory;
      const matchesDifficulty = selectedDifficulty === 'all' || tmpl.difficulty === selectedDifficulty;
      const matchesSearch = tmpl.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesDifficulty && matchesSearch;
    });
  }, [selectedCategory, selectedDifficulty, searchQuery]);

  // Group by difficulty for section headers
  const sections = useMemo(() => {
    if (selectedDifficulty !== 'all') {
      return [{ difficulty: selectedDifficulty, templates: filtered }];
    }
    const groups: { difficulty: ChallengeDifficulty; templates: ChallengeTemplate[] }[] = [];
    for (const diff of ['easy', 'medium', 'hard'] as ChallengeDifficulty[]) {
      const items = filtered.filter((t) => t.difficulty === diff);
      if (items.length > 0) groups.push({ difficulty: diff, templates: items });
    }
    return groups;
  }, [filtered, selectedDifficulty]);

  const handleTemplatePress = (template: ChallengeTemplate) => {
    router.push({
      pathname: '/challenge/create',
      params: {
        templateTitle: template.title,
        templateCategory: template.category,
        templateMetric: template.metric || '',
        templateTarget: template.target?.toString() || '',
        templateDescription: template.description,
        templateDifficulty: template.difficulty,
        templateDuration: template.defaultDuration.toString(),
        templateFrequency: template.frequency ?? 'daily',
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('explore.title')}</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.secondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('explore.search')}
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filters */}
      <View style={styles.filtersSection}>
        {/* Category chips */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>{t('explore.category')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categories}
          >
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.categoryChip,
                  selectedCategory === cat.key && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(cat.key)}
              >
                <Ionicons
                  name={cat.icon}
                  size={16}
                  color={selectedCategory === cat.key ? colors.white : colors.textPrimary}
                />
                <Text
                  style={[
                    styles.categoryLabel,
                    selectedCategory === cat.key && styles.categoryLabelActive,
                  ]}
                >
                  {cat.key === 'all' ? 'All' : t(`explore.${cat.key}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Divider */}
        <View style={styles.filterDivider} />

        {/* Difficulty chips */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>{t('explore.difficulty')}</Text>
          <View style={styles.difficultyChips}>
            {DIFFICULTY_FILTERS.map((df) => {
              const isActive = selectedDifficulty === df.key;
              const chipColor = df.key === 'all' ? colors.primary : df.color;
              return (
                <TouchableOpacity
                  key={df.key}
                  style={[
                    styles.diffChip,
                    { borderColor: df.key === 'all' ? colors.border : df.color },
                    isActive && { backgroundColor: chipColor, borderColor: chipColor },
                  ]}
                  onPress={() => setSelectedDifficulty(df.key)}
                >
                  <Text style={[
                    styles.diffChipText,
                    { color: df.key === 'all' ? colors.textSecondary : df.color },
                    isActive && { color: colors.white },
                  ]}>
                    {df.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* Template list grouped by difficulty */}
      <ScrollView
        contentContainerStyle={styles.templateList}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section) => (
          <View key={section.difficulty}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: DIFFICULTY_COLORS[section.difficulty] }]} />
              <Text style={[styles.sectionTitle, { color: DIFFICULTY_COLORS[section.difficulty] }]}>
                {section.difficulty.charAt(0).toUpperCase() + section.difficulty.slice(1)} Challenges
              </Text>
              <Text style={styles.sectionCount}>{section.templates.length}</Text>
            </View>
            {section.templates.map((template) => (
              <Card
                key={template.id}
                variant="elevated"
                onPress={() => handleTemplatePress(template)}
                style={styles.templateCard}
              >
                <View style={styles.templateRow}>
                  <View style={[
                    styles.templateIcon,
                    { backgroundColor: `${DIFFICULTY_COLORS[template.difficulty]}15` },
                  ]}>
                    <Ionicons
                      name={template.icon}
                      size={22}
                      color={DIFFICULTY_COLORS[template.difficulty]}
                    />
                  </View>
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateTitle}>{template.title}</Text>
                    <Text style={styles.templateDesc} numberOfLines={1}>
                      {template.description}
                    </Text>
                    <View style={styles.templateMeta}>
                      <View style={styles.metaChip}>
                        <Ionicons name="time-outline" size={12} color={colors.textTertiary} />
                        <Text style={styles.metaText}>{durationLabel(template.defaultDuration)}</Text>
                      </View>
                      <View style={[styles.metaChip, { backgroundColor: `${DIFFICULTY_COLORS[template.difficulty]}15` }]}>
                        <Text style={[styles.metaText, { color: DIFFICULTY_COLORS[template.difficulty], fontWeight: '600' }]}>
                          {template.difficulty.charAt(0).toUpperCase() + template.difficulty.slice(1)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.templateStake}>
                    <View style={styles.stakeChip}>
                      <Ionicons name="wallet" size={12} color={colors.stakeGoldDark} />
                      <Text style={styles.stakeChipText}>{template.suggestedStake}</Text>
                    </View>
                    <Text style={styles.stakeTokenLabel}>tokens</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        ))}

        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No challenges found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.largeTitle,
    color: colors.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 40,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    padding: 0,
  },
  filtersSection: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
  },
  filterRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  filterLabel: {
    ...typography.caption1,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  filterDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },
  categories: {
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
  },
  categoryLabel: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.textPrimary,
    marginLeft: spacing.xs,
  },
  categoryLabelActive: {
    color: colors.white,
  },
  // ── Difficulty filter chips ──
  difficultyChips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  diffChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  diffChipText: {
    ...typography.caption1,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  // ── Template list ──
  templateList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    ...typography.title3,
    flex: 1,
  },
  sectionCount: {
    ...typography.caption1,
    color: colors.textTertiary,
    fontWeight: '600',
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  templateCard: {
    marginBottom: spacing.sm,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  templateIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  templateInfo: {
    flex: 1,
  },
  templateTitle: {
    ...typography.headline,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  templateDesc: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  templateMeta: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
    gap: 3,
  },
  metaText: {
    ...typography.caption2,
    color: colors.textTertiary,
  },
  templateStake: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  stakeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDE7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 3,
  },
  stakeChipText: {
    ...typography.caption1,
    fontWeight: '700',
    color: colors.stakeGoldDark,
  },
  stakeTokenLabel: {
    ...typography.caption2,
    color: colors.textTertiary,
    marginTop: 2,
  },
  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.headline,
    color: colors.textSecondary,
  },
  emptySubtext: {
    ...typography.footnote,
    color: colors.textTertiary,
  },
});
