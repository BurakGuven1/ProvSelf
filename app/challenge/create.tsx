import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { addDays, format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import { useChallengeStore } from '@/src/stores/challenge-store';
import { useStakeStore } from '@/src/stores/stake-store';
import Button from '@/src/components/Button';
import Card from '@/src/components/Card';
import StakeAmount from '@/src/components/StakeAmount';
import type { ChallengeCategory, VerificationType } from '@/src/types/database';

const DURATION_OPTIONS = [7, 14, 30, 60, 90];
const STAKE_OPTIONS = [500, 1000, 2000, 5000]; // cents
const CATEGORIES: { key: ChallengeCategory; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'fitness', icon: 'barbell' },
  { key: 'health', icon: 'heart' },
  { key: 'productivity', icon: 'rocket' },
  { key: 'mindfulness', icon: 'leaf' },
  { key: 'custom', icon: 'create' },
];

export default function CreateChallengeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    templateTitle?: string;
    templateCategory?: string;
    templateMetric?: string;
    templateTarget?: string;
    templateDescription?: string;
  }>();

  const { createChallenge, loading } = useChallengeStore();
  const { balance } = useStakeStore();

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(params.templateTitle || '');
  const [description, setDescription] = useState(params.templateDescription || '');
  const [category, setCategory] = useState<ChallengeCategory>(
    (params.templateCategory as ChallengeCategory) || 'fitness'
  );
  const [duration, setDuration] = useState(30);
  const [stakeCents, setStakeCents] = useState(1000);
  const [verificationType, setVerificationType] = useState<VerificationType>(
    params.templateMetric ? 'healthkit' : 'photo_ai'
  );
  const [healthMetric, setHealthMetric] = useState(params.templateMetric || 'steps');
  const [healthTarget, setHealthTarget] = useState(params.templateTarget || '10000');

  const totalSteps = 4;

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert(t('common.error'), 'Please enter a challenge title.');
      return;
    }

    const currentBalance = balance?.balance_cents ?? 0;
    if (currentBalance < stakeCents) {
      Alert.alert(t('stake.insufficient_balance'), '', [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('stake.add_funds'), onPress: () => router.push('/stake/purchase') },
      ]);
      return;
    }

    const startDate = new Date();
    const endDate = addDays(startDate, duration);

    try {
      await createChallenge({
        title: title.trim(),
        description: description.trim() || null,
        category,
        frequency: 'daily',
        duration_days: duration,
        required_completions: duration,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        stake_cents: stakeCents,
        verification_type: verificationType,
        verification_config:
          verificationType === 'healthkit'
            ? { metric: healthMetric, target: parseInt(healthTarget, 10) || 0 }
            : { description: title.trim() },
        status: 'active',
        completed_days: 0,
        failed_days: 0,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch {
      Alert.alert(t('common.error'), t('common.retry'));
    }
  };

  const goNext = () => {
    if (step === 0 && !title.trim()) {
      Alert.alert(t('common.error'), 'Please enter what you want to prove.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  };

  const goBack = () => {
    if (step === 0) {
      router.back();
    } else {
      setStep((s) => s - 1);
    }
  };

  const renderStep0 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('challenge.what_habit')}</Text>
      <TextInput
        style={styles.titleInput}
        placeholder="e.g., 10,000 steps daily"
        placeholderTextColor={colors.textTertiary}
        value={title}
        onChangeText={setTitle}
        autoFocus
        maxLength={60}
      />
      {title.length > 0 && (
        <TextInput
          style={styles.descInput}
          placeholder="Add details (optional)"
          placeholderTextColor={colors.textTertiary}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={200}
        />
      )}

      <Text style={styles.fieldLabel}>{t('challenge.category')}</Text>
      <View style={styles.optionRow}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.categoryOption, category === cat.key && styles.optionSelected]}
            onPress={() => setCategory(cat.key)}
          >
            <Ionicons
              name={cat.icon}
              size={20}
              color={category === cat.key ? colors.white : colors.textPrimary}
            />
            <Text
              style={[
                styles.optionLabel,
                category === cat.key && styles.optionLabelSelected,
              ]}
            >
              {t(`explore.${cat.key}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('challenge.how_long')}</Text>
      <View style={styles.durationGrid}>
        {DURATION_OPTIONS.map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.durationOption, duration === d && styles.optionSelected]}
            onPress={() => setDuration(d)}
          >
            <Text
              style={[
                styles.durationValue,
                duration === d && styles.optionLabelSelected,
              ]}
            >
              {d}
            </Text>
            <Text
              style={[
                styles.durationLabel,
                duration === d && styles.optionLabelSelected,
              ]}
            >
              days
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('challenge.verification_method')}</Text>
      <Card
        onPress={() => setVerificationType('healthkit')}
        style={[
          styles.verifyCard,
          verificationType === 'healthkit' && styles.verifyCardSelected,
        ]}
      >
        <View style={styles.verifyRow}>
          <View style={[styles.verifyIcon, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="heart" size={22} color={colors.success} />
          </View>
          <View style={styles.verifyInfo}>
            <Text style={styles.verifyTitle}>{t('challenge.healthkit_option')}</Text>
            <Text style={styles.verifyDesc}>Steps, calories, exercise, sleep</Text>
          </View>
          {verificationType === 'healthkit' && (
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          )}
        </View>
      </Card>

      <Card
        onPress={() => setVerificationType('photo_ai')}
        style={[
          styles.verifyCard,
          verificationType === 'photo_ai' && styles.verifyCardSelected,
        ]}
      >
        <View style={styles.verifyRow}>
          <View style={[styles.verifyIcon, { backgroundColor: '#E3F2FD' }]}>
            <Ionicons name="camera" size={22} color={colors.accent} />
          </View>
          <View style={styles.verifyInfo}>
            <Text style={styles.verifyTitle}>{t('challenge.photo_option')}</Text>
            <Text style={styles.verifyDesc}>Take a photo, AI verifies it</Text>
          </View>
          {verificationType === 'photo_ai' && (
            <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
          )}
        </View>
      </Card>

      {verificationType === 'healthkit' && (
        <View style={styles.healthConfig}>
          <Text style={styles.fieldLabel}>Metric & target</Text>
          <View style={styles.healthRow}>
            <TouchableOpacity
              style={[styles.metricBtn, healthMetric === 'steps' && styles.optionSelected]}
              onPress={() => { setHealthMetric('steps'); setHealthTarget('10000'); }}
            >
              <Text style={[styles.optionLabel, healthMetric === 'steps' && styles.optionLabelSelected]}>Steps</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.metricBtn, healthMetric === 'active_calories' && styles.optionSelected]}
              onPress={() => { setHealthMetric('active_calories'); setHealthTarget('500'); }}
            >
              <Text style={[styles.optionLabel, healthMetric === 'active_calories' && styles.optionLabelSelected]}>Calories</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.metricBtn, healthMetric === 'exercise_minutes' && styles.optionSelected]}
              onPress={() => { setHealthMetric('exercise_minutes'); setHealthTarget('30'); }}
            >
              <Text style={[styles.optionLabel, healthMetric === 'exercise_minutes' && styles.optionLabelSelected]}>Minutes</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.targetInput}
            value={healthTarget}
            onChangeText={setHealthTarget}
            keyboardType="number-pad"
            placeholder="Target value"
            placeholderTextColor={colors.textTertiary}
          />
        </View>
      )}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('challenge.how_much_stake')}</Text>
      <Text style={styles.stakeExplanation}>{t('challenge.stake_explanation')}</Text>

      <View style={styles.stakeGrid}>
        {STAKE_OPTIONS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.stakeOption, stakeCents === s && styles.stakeOptionSelected]}
            onPress={() => setStakeCents(s)}
          >
            <Text
              style={[
                styles.stakeValue,
                stakeCents === s && styles.stakeValueSelected,
              ]}
            >
              ${(s / 100).toFixed(0)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Card style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Challenge Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Challenge</Text>
          <Text style={styles.summaryValue}>{title}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Duration</Text>
          <Text style={styles.summaryValue}>{duration} days</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Verification</Text>
          <Text style={styles.summaryValue}>
            {verificationType === 'healthkit' ? 'Apple Health' : 'Photo AI'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Stake</Text>
          <StakeAmount cents={stakeCents} size="md" />
        </View>
      </Card>
    </View>
  );

  const steps = [renderStep0, renderStep1, renderStep2, renderStep3];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={goBack} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          <Text style={styles.navText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.stepIndicator}>{step + 1}/{totalSteps}</Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((step + 1) / totalSteps) * 100}%` }]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {steps[step]()}
      </ScrollView>

      <View style={styles.footer}>
        {step < totalSteps - 1 ? (
          <Button title={t('common.next')} onPress={goNext} size="lg" fullWidth />
        ) : (
          <Button
            title={t('challenge.start_challenge')}
            onPress={handleCreate}
            loading={loading}
            size="lg"
            fullWidth
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  stepIndicator: {
    ...typography.subhead,
    color: colors.textSecondary,
  },
  progressBar: {
    height: 3,
    backgroundColor: colors.backgroundSecondary,
    marginHorizontal: spacing.lg,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  stepContent: {},
  stepTitle: {
    ...typography.title1,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  titleInput: {
    ...typography.title3,
    color: colors.textPrimary,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  descInput: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  fieldLabel: {
    ...typography.headline,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
  },
  optionSelected: {
    backgroundColor: colors.primary,
  },
  optionLabel: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.textPrimary,
    marginLeft: spacing.xs,
  },
  optionLabelSelected: {
    color: colors.white,
  },
  durationGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  durationOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.backgroundSecondary,
  },
  durationValue: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  durationLabel: {
    ...typography.caption1,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  verifyCard: {
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.transparent,
  },
  verifyCardSelected: {
    borderColor: colors.accent,
  },
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifyIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  verifyInfo: {
    flex: 1,
  },
  verifyTitle: {
    ...typography.headline,
    color: colors.textPrimary,
  },
  verifyDesc: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginTop: 2,
  },
  healthConfig: {
    marginTop: spacing.md,
  },
  healthRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  metricBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
  },
  targetInput: {
    ...typography.title3,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    textAlign: 'center',
  },
  stakeExplanation: {
    ...typography.subhead,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  stakeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  stakeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 2,
    borderColor: colors.transparent,
  },
  stakeOptionSelected: {
    borderColor: colors.stakeGold,
    backgroundColor: '#FFFDE7',
  },
  stakeValue: {
    ...typography.title1,
    color: colors.textPrimary,
  },
  stakeValueSelected: {
    color: colors.stakeGoldDark,
  },
  summaryCard: {
    backgroundColor: colors.backgroundSecondary,
  },
  summaryTitle: {
    ...typography.headline,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.backgroundTertiary,
  },
  summaryLabel: {
    ...typography.subhead,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.subhead,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.backgroundTertiary,
  },
});
