import { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { addDays, format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import { supabase } from '@/src/lib/supabase';
import { getHydrationHealthConfig, isHydrationChallenge } from '@/src/lib/challenge-rules';
import { useChallengeStore } from '@/src/stores/challenge-store';
import { useStakeStore } from '@/src/stores/stake-store';
import Button from '@/src/components/Button';
import Card from '@/src/components/Card';
import StakeAmount from '@/src/components/StakeAmount';
import type {
  ChallengeCategory,
  ChallengeDifficulty,
  ProofClass,
  VerificationPolicy,
  VerificationType,
} from '@/src/types/database';

// ── Duration options ──
const DURATION_OPTIONS = [
  { days: 7, label: '1 Week' },
  { days: 14, label: '2 Weeks' },
  { days: 30, label: '1 Month' },
  { days: 90, label: '3 Months' },
  { days: 180, label: '6 Months' },
  { days: 365, label: '1 Year' },
];

// ── Difficulty options ──
const DIFFICULTY_OPTIONS: { key: ChallengeDifficulty; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'easy', icon: 'leaf', color: colors.success },
  { key: 'medium', icon: 'flame', color: colors.warning },
  { key: 'hard', icon: 'skull', color: colors.danger },
];

// ── Stake calculation: duration x difficulty ──
// Base tokens for each duration (easy difficulty)
const BASE_STAKE: Record<number, number> = {
  7: 100,
  14: 200,
  30: 500,
  90: 1500,
  180: 3000,
  365: 5000,
};

// Difficulty multiplier
const DIFFICULTY_MULTIPLIER: Record<ChallengeDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 4,
};

function calculateStake(durationDays: number, difficulty: ChallengeDifficulty): number {
  const base = BASE_STAKE[durationDays] ?? 100;
  return base * DIFFICULTY_MULTIPLIER[difficulty];
}

// ── Classifier state machine ──
// The classify-challenge edge function is called when the user leaves
// step 0 (title entered). The result drives which verification methods
// are allowed in step 3 and is persisted on the challenge row at create
// time. If classification fails, we fall back to legacy behavior so
// challenge creation is not blocked.
type ClassifierResult = {
  proof_class: ProofClass;
  recommended_method: VerificationType;
  verification_policy: VerificationPolicy;
  reasoning: string;
};

type ClassifierState =
  | { status: 'idle' }
  | { status: 'loading'; titleKey: string }
  | { status: 'done'; titleKey: string; data: ClassifierResult }
  | { status: 'error'; titleKey: string; error: string };

// Build a stable key from title+description+category so we know whether
// the cached classifier result still matches the user's current inputs.
function classifierKey(title: string, description: string, category: string): string {
  return `${title.trim()}|${description.trim()}|${category}`.toLowerCase();
}

function buildLegacyClassifierFallback(method: VerificationType): ClassifierResult {
  // Classifier is an enhancement. When unavailable, preserve the user's
  // selected legacy verification flow instead of blocking challenge creation.
  if (method === 'healthkit') {
    return {
      proof_class: 'high',
      recommended_method: 'healthkit',
      verification_policy: {
        allowed_methods: ['healthkit'],
        hard_block_methods: ['photo_ai'],
        min_evidence_count: 1,
        time_window_hours: 24,
      },
      reasoning: 'Classifier unavailable; fallback to legacy HealthKit policy.',
    };
  }

  return {
    proof_class: 'medium',
    recommended_method: 'photo_ai',
    verification_policy: {
      allowed_methods: ['photo_ai'],
      hard_block_methods: [],
      min_evidence_count: 1,
      time_window_hours: 24,
    },
    reasoning: 'Classifier unavailable; fallback to legacy photo policy.',
  };
}

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
    templateDifficulty?: string;
    templateDuration?: string;
  }>();

  const { createChallenge, loading } = useChallengeStore();
  const { balance, deductStake, returnStake } = useStakeStore();

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(params.templateTitle || '');
  const [description, setDescription] = useState(params.templateDescription || '');
  const [category, setCategory] = useState<ChallengeCategory>(
    (params.templateCategory as ChallengeCategory) || 'fitness'
  );
  const [duration, setDuration] = useState(
    params.templateDuration ? parseInt(params.templateDuration, 10) : 30
  );
  const [difficulty, setDifficulty] = useState<ChallengeDifficulty>(
    (params.templateDifficulty as ChallengeDifficulty) || 'easy'
  );
  const [verificationType, setVerificationType] = useState<VerificationType>(
    params.templateMetric ? 'healthkit' : 'photo_ai'
  );
  const [healthMetric, setHealthMetric] = useState(params.templateMetric || 'steps');
  const [healthTarget, setHealthTarget] = useState(params.templateTarget || '10000');
  const hydrationChallenge = isHydrationChallenge(title, description);

  // Hydration challenges must be HealthKit-based.
  useEffect(() => {
    if (!hydrationChallenge) return;
    setVerificationType('healthkit');
    setHealthMetric('water_ml');
    setHealthTarget((prev) => {
      const parsed = parseInt(prev, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) return '2000';
      if (prev === '10000' || prev === '500' || prev === '30') return '2000';
      return prev;
    });
  }, [hydrationChallenge]);

  // ── Classifier state ──
  // `classifier` is the current state; `classifierRequestId` is a monotonic
  // counter so stale in-flight responses (from a previous title) get
  // dropped when the user edits and re-triggers classification.
  const [classifier, setClassifier] = useState<ClassifierState>({ status: 'idle' });
  const classifierRequestId = useRef(0);

  const totalSteps = 5; // +1 for difficulty step

  const stakeCents = useMemo(
    () => calculateStake(duration, difficulty),
    [duration, difficulty]
  );

  const currentBalance = balance?.balance_cents ?? 0;
  const insufficientBalance = currentBalance < stakeCents;

  // Trigger the classify-challenge edge function. Returns the sanitized
  // result or throws. Use `runClassifier()` as fire-and-forget to warm the
  // cache, or `awaitClassifier()` to block on it before creating the
  // challenge. The requestId guard ensures stale responses are ignored
  // when the user edits the title and re-triggers.
  const runClassifier = async (force = false): Promise<ClassifierResult> => {
    const key = classifierKey(title, description, category);

    // Reuse cached result if inputs haven't changed.
    if (
      !force &&
      classifier.status === 'done' &&
      classifier.titleKey === key
    ) {
      return classifier.data;
    }

    const myRequestId = ++classifierRequestId.current;
    setClassifier({ status: 'loading', titleKey: key });

    try {
      const { data, error } = await supabase.functions.invoke('classify-challenge', {
        body: {
          title: title.trim(),
          description: description.trim() || undefined,
          category,
        },
      });

      // Drop stale responses (user edited title and re-triggered).
      if (myRequestId !== classifierRequestId.current) {
        throw new Error('Classification superseded by newer request');
      }

      if (error) {
        throw new Error(error.message ?? 'Classifier request failed');
      }
      if (!data || typeof data !== 'object' || typeof data.proof_class !== 'string') {
        throw new Error('Classifier returned invalid payload');
      }

      const result = data as ClassifierResult;

      // Auto-switch verificationType if the user's current choice is now
      // hard-blocked by the classifier. Prefer the classifier's
      // recommended method.
      const blocked = result.verification_policy.hard_block_methods ?? [];
      setVerificationType((current) => {
        if (blocked.includes(current)) {
          return result.recommended_method;
        }
        return current;
      });

      setClassifier({ status: 'done', titleKey: key, data: result });
      return result;
    } catch (err) {
      if (myRequestId !== classifierRequestId.current) {
        // Superseded — keep the newer state, don't downgrade to error.
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[create] classifier unavailable, using legacy fallback:', message);
      const fallbackMethod: VerificationType = hydrationChallenge ? 'healthkit' : verificationType;
      const fallback = buildLegacyClassifierFallback(fallbackMethod);
      setClassifier({ status: 'done', titleKey: key, data: fallback });
      return fallback;
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert(t('common.error'), t('challenge.title_required'));
      return;
    }

    if (insufficientBalance) {
      Alert.alert(t('stake.insufficient_balance'), '', [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('stake.add_funds'), onPress: () => router.push('/stake/purchase') },
      ]);
      return;
    }

    // Final safeguard: hydration challenges always use HealthKit.
    const effectiveVerificationType: VerificationType =
      hydrationChallenge ? 'healthkit' : verificationType;

    // ── Classifier gate ──
    // Try classification first, but fail-open to legacy flow if the
    // classifier service is unavailable. This prevents challenge creation
    // from being blocked by an auxiliary AI dependency.
    let classification: ClassifierResult | null = null;
    try {
      classification = await runClassifier(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[create] classifier gate fallback:', message);
      classification = buildLegacyClassifierFallback(effectiveVerificationType);
      const key = classifierKey(title, description, category);
      setClassifier({ status: 'done', titleKey: key, data: classification });
    }

    // Guard: if the user's picked verification_type is still hard-blocked
    // after classification, stop and ask them to fix it.
    if (
      classification &&
      classification.verification_policy.hard_block_methods.includes(effectiveVerificationType)
    ) {
      Alert.alert(
        t('verification.low_proof_blocked_title', {
          defaultValue: 'Verification Method Blocked',
        }),
        t('verification.low_proof_blocked_message', {
          defaultValue:
            'This challenge requires a different verification method. Please choose the recommended option.',
        }),
      );
      return;
    }

    const startDate = new Date();
    const endDate = addDays(startDate, Math.max(duration - 1, 0));

    try {
      await deductStake(stakeCents);

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
          verification_type: effectiveVerificationType,
          verification_config:
            effectiveVerificationType === 'healthkit'
              ? hydrationChallenge
                ? getHydrationHealthConfig()
                : { metric: healthMetric, target: parseInt(healthTarget, 10) || 0 }
              : { description: title.trim() },
          // Legacy-safe fallback when classifier is unavailable.
          proof_class: classification?.proof_class ?? null,
          verification_policy: classification?.verification_policy ?? null,
          status: 'active',
          completed_days: 0,
          failed_days: 0,
        });
      } catch (createErr) {
        await returnStake(stakeCents);
        throw createErr;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch {
      Alert.alert(t('common.error'), t('common.retry'));
    }
  };

  const goNext = () => {
    if (step === 0 && !title.trim()) {
      Alert.alert(t('common.error'), t('challenge.missing_title'));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Fire classification as soon as the user leaves step 0. By the time
    // they pick duration + difficulty, the result should be ready to
    // disable hard-blocked methods in step 3. Fire-and-forget: errors are
    // swallowed here and re-raised at handleCreate.
    if (step === 0) {
      runClassifier(false).catch(() => {
        // Non-fatal at this stage — handleCreate will retry + surface error.
      });
    }

    setStep((s) => Math.min(s + 1, totalSteps - 1));
  };

  const goBack = () => {
    if (step === 0) {
      router.back();
    } else {
      setStep((s) => s - 1);
    }
  };

  // ── Step 0: What habit ──
  const renderStep0 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('challenge.what_habit')}</Text>
      <TextInput
        style={styles.titleInput}
        placeholder={t('challenge.title_placeholder')}
        placeholderTextColor={colors.textTertiary}
        value={title}
        onChangeText={setTitle}
        autoFocus
        maxLength={60}
      />
      {title.length > 0 && (
        <TextInput
          style={styles.descInput}
          placeholder={t('challenge.description_placeholder')}
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

  // ── Step 1: Duration ──
  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('challenge.how_long')}</Text>
      <View style={styles.durationGrid}>
        {DURATION_OPTIONS.map((d) => (
          <TouchableOpacity
            key={d.days}
            style={[styles.durationOption, duration === d.days && styles.optionSelected]}
            onPress={() => setDuration(d.days)}
          >
            <Text
              style={[
                styles.durationValue,
                duration === d.days && styles.optionLabelSelected,
              ]}
            >
              {d.days}
            </Text>
            <Text
              style={[
                styles.durationLabel,
                duration === d.days && styles.optionLabelSelected,
              ]}
            >
              {d.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // ── Step 2: Difficulty ──
  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('challenge.difficulty_question')}</Text>
      <Text style={styles.stakeExplanation}>
        {t('challenge.difficulty_explanation')}
      </Text>
      <View style={styles.difficultyGrid}>
        {DIFFICULTY_OPTIONS.map((d) => {
          const stakeForThis = calculateStake(duration, d.key);
          const isSelected = difficulty === d.key;
          return (
            <TouchableOpacity
              key={d.key}
              style={[
                styles.difficultyCard,
                isSelected && { borderColor: d.color, backgroundColor: `${d.color}10` },
              ]}
              onPress={() => {
                setDifficulty(d.key);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <View style={[styles.difficultyIconWrap, { backgroundColor: `${d.color}20` }]}>
                <Ionicons name={d.icon} size={28} color={d.color} />
              </View>
              <Text style={[styles.difficultyLabel, isSelected && { color: d.color }]}>
                {t(`challenge.difficulty_${d.key}`)}
              </Text>
              <View style={styles.difficultyStakeRow}>
                <Ionicons name="wallet" size={14} color={colors.stakeGoldDark} />
                <Text style={styles.difficultyStake}>{stakeForThis}</Text>
              </View>
              <Text style={styles.difficultyStakeLabel}>{t('challenge.tokens_label')}</Text>
              {isSelected && (
                <View style={[styles.difficultyCheck, { backgroundColor: d.color }]}>
                  <Ionicons name="checkmark" size={14} color={colors.white} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.stakePreview}>
        <Text style={styles.stakePreviewText}>
          {t('challenge.stake_summary_format', {
            duration: DURATION_OPTIONS.find((d) => d.days === duration)?.label ?? `${duration} ${t('challenge.duration').toLowerCase()}`,
            difficulty: t(`challenge.difficulty_${difficulty}`),
            tokens: stakeCents,
          })}
        </Text>
      </View>
    </View>
  );

  // ── Step 3: Verification ──
  const renderStep3 = () => {
    // Read classifier verdict. When classifier is still loading, we don't
    // disable cards (optimistic UX) but we show a subtle spinner. When it
    // has failed, we show a retry affordance — create will also retry.
    const classifierData =
      classifier.status === 'done' ? classifier.data : null;
    const hardBlocked = classifierData?.verification_policy.hard_block_methods ?? [];
    const photoBlocked = hardBlocked.includes('photo_ai') || hydrationChallenge;
    const healthkitBlocked = hardBlocked.includes('healthkit') && !hydrationChallenge;
    const classifying = classifier.status === 'loading';
    const classifierError = classifier.status === 'error';

    return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('challenge.verification_method')}</Text>

      {classifying && (
        <View style={styles.classifyingRow}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.classifyingText}>
            {t('verification.classifying', {
              defaultValue: 'Analyzing challenge verification rules...',
            })}
          </Text>
        </View>
      )}

      {classifierError && (
        <View style={styles.hydrationWarning}>
          <Ionicons name="warning" size={18} color={colors.warning} />
          <Text style={styles.hydrationWarningText}>
            {t('verification.classification_failed_message', {
              defaultValue: "We couldn't analyze this challenge right now. You can retry or continue.",
            })}
          </Text>
          <TouchableOpacity onPress={() => runClassifier(true).catch(() => {})}>
            <Text style={styles.classifyRetryLink}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {photoBlocked && (
        <View style={styles.hydrationWarning}>
          <Ionicons name="information-circle" size={18} color={colors.accent} />
          <Text style={styles.hydrationWarningText}>
            {hydrationChallenge
              ? t('verification.hydration_healthkit_required', {
                  defaultValue:
                    'Hydration challenges are verified only with Apple Health. Photo proof is disabled.',
                })
              : t('verification.low_proof_blocked_message', {
                  defaultValue:
                    'This challenge requires a different verification method. Please choose the recommended option.',
                })}
          </Text>
        </View>
      )}

      <Card
        onPress={
          healthkitBlocked
            ? undefined
            : () => setVerificationType('healthkit')
        }
        style={[
          styles.verifyCard,
          verificationType === 'healthkit' && styles.verifyCardSelected,
          healthkitBlocked && styles.verifyCardDisabled,
        ]}
      >
        <View style={styles.verifyRow}>
          <View style={[styles.verifyIcon, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="heart" size={22} color={colors.success} />
          </View>
          <View style={styles.verifyInfo}>
            <Text style={styles.verifyTitle}>{t('challenge.healthkit_option')}</Text>
            <Text style={styles.verifyDesc}>{t('challenge.healthkit_desc')}</Text>
            {healthkitBlocked && (
              <Text style={styles.verifyBlockedHint}>
                {t('verification.photo_method_disabled', {
                  defaultValue: 'This verification method is disabled for this challenge.',
                })}
              </Text>
            )}
          </View>
          {verificationType === 'healthkit' && !healthkitBlocked && (
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          )}
        </View>
      </Card>

      <Card
        onPress={
          photoBlocked
            ? undefined
            : () => setVerificationType('photo_ai')
        }
        style={[
          styles.verifyCard,
          verificationType === 'photo_ai' && !photoBlocked && styles.verifyCardSelected,
          photoBlocked && styles.verifyCardDisabled,
        ]}
      >
        <View style={styles.verifyRow}>
          <View style={[styles.verifyIcon, { backgroundColor: '#E3F2FD' }]}>
            <Ionicons name="camera" size={22} color={photoBlocked ? colors.textTertiary : colors.accent} />
          </View>
          <View style={styles.verifyInfo}>
            <Text style={[styles.verifyTitle, photoBlocked && styles.verifyTitleDisabled]}>
              {t('challenge.photo_option')}
            </Text>
            <Text style={styles.verifyDesc}>{t('challenge.photo_desc')}</Text>
            {photoBlocked && (
              <Text style={styles.verifyBlockedHint}>
                {t('verification.photo_method_disabled', {
                  defaultValue: 'This verification method is disabled for this challenge.',
                })}
              </Text>
            )}
          </View>
          {verificationType === 'photo_ai' && !photoBlocked && (
            <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
          )}
        </View>
      </Card>

      {verificationType === 'healthkit' && (
        <View style={styles.healthConfig}>
          <Text style={styles.fieldLabel}>{t('challenge.metric_target')}</Text>
          <View style={styles.healthRow}>
            <TouchableOpacity
              style={[styles.metricBtn, healthMetric === 'steps' && styles.optionSelected]}
              onPress={() => { setHealthMetric('steps'); setHealthTarget('10000'); }}
            >
              <Text style={[styles.optionLabel, healthMetric === 'steps' && styles.optionLabelSelected]}>{t('challenge.metric_steps')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.metricBtn, healthMetric === 'active_calories' && styles.optionSelected]}
              onPress={() => { setHealthMetric('active_calories'); setHealthTarget('500'); }}
            >
              <Text style={[styles.optionLabel, healthMetric === 'active_calories' && styles.optionLabelSelected]}>{t('challenge.metric_calories')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.metricBtn, healthMetric === 'exercise_minutes' && styles.optionSelected]}
              onPress={() => { setHealthMetric('exercise_minutes'); setHealthTarget('30'); }}
            >
              <Text style={[styles.optionLabel, healthMetric === 'exercise_minutes' && styles.optionLabelSelected]}>{t('challenge.metric_minutes')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.metricBtn, healthMetric === 'water_ml' && styles.optionSelected]}
              onPress={() => { setHealthMetric('water_ml'); setHealthTarget('2000'); }}
            >
              <Text style={[styles.optionLabel, healthMetric === 'water_ml' && styles.optionLabelSelected]}>{t('challenge.metric_water')}</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.targetInput}
            value={healthTarget}
            onChangeText={setHealthTarget}
            keyboardType="number-pad"
            placeholder={t('challenge.target_value_placeholder')}
            placeholderTextColor={colors.textTertiary}
          />
        </View>
      )}
    </View>
    );
  };

  // ── Step 4: Summary ──
  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('challenge.how_much_stake')}</Text>
      <Text style={styles.stakeExplanation}>{t('challenge.stake_explanation')}</Text>

      <View style={styles.balanceIndicator}>
        <Ionicons name="wallet" size={18} color={colors.stakeGoldDark} />
        <Text style={styles.balanceText}>
          {t('challenge.balance_label')}{' '}
          <Text style={styles.balanceBold}>
            {t('challenge.balance_tokens', { count: currentBalance })}
          </Text>
        </Text>
        {insufficientBalance && (
          <TouchableOpacity
            onPress={() => router.push('/stake/purchase')}
            style={styles.addFundsBtn}
          >
            <Text style={styles.addFundsText}>{t('challenge.add_funds_short')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stake display */}
      <View style={styles.stakeDisplay}>
        <Ionicons name="wallet" size={32} color={colors.stakeGoldDark} />
        <Text style={styles.stakeDisplayValue}>{stakeCents}</Text>
        <Text style={styles.stakeDisplayLabel}>{t('challenge.tokens_at_stake_label')}</Text>
        <View style={styles.stakeBreakdown}>
          <Text style={styles.stakeBreakdownText}>
            {t('challenge.stake_breakdown', {
              duration: DURATION_OPTIONS.find((d) => d.days === duration)?.label ?? `${duration}`,
              difficulty: t(`challenge.difficulty_${difficulty}`),
            })}
          </Text>
        </View>
      </View>

      {/* Risk/reward */}
      <View style={styles.riskCard}>
        <View style={styles.riskRow}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.riskText}>
            {t('challenge.complete_returns', { tokens: stakeCents })}
          </Text>
        </View>
        <View style={styles.riskRow}>
          <Ionicons name="close-circle" size={18} color={colors.danger} />
          <Text style={styles.riskText}>
            {t('challenge.give_up_forfeits', { tokens: stakeCents })}
          </Text>
        </View>
      </View>

      <Card style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>{t('challenge.summary_title')}</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('challenge.summary_challenge')}</Text>
          <Text style={styles.summaryValue} numberOfLines={1}>{title}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('challenge.summary_duration')}</Text>
          <Text style={styles.summaryValue}>
            {DURATION_OPTIONS.find((d) => d.days === duration)?.label ?? `${duration}`}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('challenge.summary_difficulty')}</Text>
          <Text style={[
            styles.summaryValue,
            { color: DIFFICULTY_OPTIONS.find((d) => d.key === difficulty)?.color },
          ]}>
            {t(`challenge.difficulty_${difficulty}`)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('challenge.summary_verification')}</Text>
          <Text style={styles.summaryValue}>
            {verificationType === 'healthkit'
              ? t('challenge.verification_apple_health')
              : t('challenge.verification_photo_ai')}
          </Text>
        </View>
        <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.summaryLabel}>{t('challenge.summary_at_stake')}</Text>
          <StakeAmount cents={stakeCents} size="md" />
        </View>
      </Card>
    </View>
  );

  const steps = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4];

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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  durationOption: {
    width: '31%',
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
    textAlign: 'center',
  },
  // ── Difficulty styles ──
  difficultyGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  difficultyCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 2,
    borderColor: colors.transparent,
  },
  difficultyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  difficultyLabel: {
    ...typography.headline,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  difficultyStakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  difficultyStake: {
    ...typography.title3,
    fontWeight: '700',
    color: colors.stakeGoldDark,
  },
  difficultyStakeLabel: {
    ...typography.caption2,
    color: colors.textTertiary,
  },
  difficultyCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stakePreview: {
    backgroundColor: '#FFFDE7',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  stakePreviewText: {
    ...typography.subhead,
    color: colors.textSecondary,
  },
  // ── Verification styles ──
  verifyCard: {
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.transparent,
  },
  verifyCardSelected: {
    borderColor: colors.accent,
  },
  verifyCardDisabled: {
    opacity: 0.45,
  },
  verifyTitleDisabled: {
    color: colors.textTertiary,
  },
  verifyBlockedHint: {
    ...typography.caption2,
    color: colors.danger,
    marginTop: 2,
    fontWeight: '600',
  },
  hydrationWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  hydrationWarningText: {
    ...typography.footnote,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 18,
  },
  classifyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  classifyingText: {
    ...typography.footnote,
    color: colors.textSecondary,
    flex: 1,
  },
  classifyRetryLink: {
    ...typography.footnote,
    color: colors.accent,
    fontWeight: '700',
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
  // ── Summary step styles ──
  stakeExplanation: {
    ...typography.subhead,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  balanceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDE7',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  balanceText: {
    ...typography.subhead,
    color: colors.textSecondary,
    flex: 1,
  },
  balanceBold: {
    fontWeight: '700',
    color: colors.stakeGoldDark,
  },
  addFundsBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  addFundsText: {
    ...typography.caption1,
    fontWeight: '700',
    color: colors.white,
  },
  stakeDisplay: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
    backgroundColor: '#FFFDE7',
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.stakeGold,
  },
  stakeDisplayValue: {
    ...typography.largeTitle,
    color: colors.stakeGoldDark,
    marginTop: spacing.sm,
  },
  stakeDisplayLabel: {
    ...typography.subhead,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  stakeBreakdown: {
    marginTop: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  stakeBreakdownText: {
    ...typography.caption1,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  riskCard: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  riskText: {
    ...typography.subhead,
    color: colors.textPrimary,
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
