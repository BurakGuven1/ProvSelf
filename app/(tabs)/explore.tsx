import { useState } from 'react';
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

interface ChallengeTemplate {
  id: string;
  title: string;
  category: string;
  icon: keyof typeof Ionicons.glyphMap;
  metric?: string;
  target?: number;
  description: string;
}

const TEMPLATES: ChallengeTemplate[] = [
  {
    id: '1',
    title: '10,000 Steps Daily',
    category: 'fitness',
    icon: 'footsteps',
    metric: 'steps',
    target: 10000,
    description: 'Walk at least 10,000 steps every day.',
  },
  {
    id: '2',
    title: 'Burn 500 Calories',
    category: 'fitness',
    icon: 'flame',
    metric: 'active_calories',
    target: 500,
    description: 'Burn at least 500 active calories daily.',
  },
  {
    id: '3',
    title: '30 Min Exercise',
    category: 'fitness',
    icon: 'barbell',
    metric: 'exercise_minutes',
    target: 30,
    description: 'Exercise for at least 30 minutes each day.',
  },
  {
    id: '4',
    title: '7 Hours of Sleep',
    category: 'health',
    icon: 'moon',
    metric: 'sleep_hours',
    target: 7,
    description: 'Get at least 7 hours of sleep every night.',
  },
  {
    id: '5',
    title: 'Gym Session',
    category: 'fitness',
    icon: 'fitness',
    description: 'Go to the gym and take a proof photo.',
  },
  {
    id: '6',
    title: 'Healthy Meal',
    category: 'health',
    icon: 'nutrition',
    description: 'Eat a healthy meal and photograph it.',
  },
  {
    id: '7',
    title: 'Read 30 Minutes',
    category: 'productivity',
    icon: 'book',
    description: 'Read for at least 30 minutes daily.',
  },
  {
    id: '8',
    title: 'Meditate',
    category: 'mindfulness',
    icon: 'leaf',
    description: 'Practice meditation or mindfulness.',
  },
  {
    id: '9',
    title: 'No Social Media',
    category: 'productivity',
    icon: 'phone-portrait-outline',
    description: 'Stay off social media for the entire day.',
  },
  {
    id: '10',
    title: 'Morning Routine',
    category: 'mindfulness',
    icon: 'sunny',
    description: 'Complete your morning routine before 8 AM.',
  },
];

const CATEGORIES = [
  { key: 'all', icon: 'grid' as const },
  { key: 'fitness', icon: 'barbell' as const },
  { key: 'health', icon: 'heart' as const },
  { key: 'productivity', icon: 'rocket' as const },
  { key: 'mindfulness', icon: 'leaf' as const },
];

export default function ExploreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = TEMPLATES.filter((tmpl) => {
    const matchesCategory = selectedCategory === 'all' || tmpl.category === selectedCategory;
    const matchesSearch = tmpl.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleTemplatePress = (template: ChallengeTemplate) => {
    router.push({
      pathname: '/challenge/create',
      params: {
        templateTitle: template.title,
        templateCategory: template.category,
        templateMetric: template.metric || '',
        templateTarget: template.target?.toString() || '',
        templateDescription: template.description,
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('explore.title')}</Text>
      </View>

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

      <ScrollView
        contentContainerStyle={styles.templateList}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>{t('explore.popular')}</Text>
        {filtered.map((template) => (
          <Card
            key={template.id}
            variant="elevated"
            onPress={() => handleTemplatePress(template)}
            style={styles.templateCard}
          >
            <View style={styles.templateRow}>
              <View style={styles.templateIcon}>
                <Ionicons name={template.icon} size={22} color={colors.accent} />
              </View>
              <View style={styles.templateInfo}>
                <Text style={styles.templateTitle}>{template.title}</Text>
                <Text style={styles.templateDesc} numberOfLines={1}>
                  {template.description}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </View>
          </Card>
        ))}
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
  categories: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
    marginRight: spacing.sm,
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
  templateList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sectionTitle: {
    ...typography.title3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
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
    backgroundColor: colors.backgroundSecondary,
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
  },
});
