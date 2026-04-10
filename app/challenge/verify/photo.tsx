import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import { countVerifiedCompletions, getCompletionSlotKey } from '@/src/lib/challenge-progress';
import { isAbstinenceChallenge } from '@/src/lib/challenge-rules';
import { supabase } from '@/src/lib/supabase';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChallengeStore } from '@/src/stores/challenge-store';
import Button from '@/src/components/Button';
import Card from '@/src/components/Card';

export default function PhotoVerifyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const { session } = useAuthStore();
  const { fetchChallengeById } = useChallengeStore();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [challengeContext, setChallengeContext] = useState<{
    title: string;
    description: string | null;
  } | null>(null);
  const [result, setResult] = useState<{
    verified: boolean;
    reasoning: string;
    missingEvidence: string[];
    retryHint: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!challengeId) return;

    (async () => {
      const challenge = await fetchChallengeById(challengeId);
      if (!mounted || !challenge) return;
      setChallengeContext({
        title: challenge.title,
        description: challenge.description,
      });
    })();

    return () => {
      mounted = false;
    };
  }, [challengeId, fetchChallengeById]);

  const abstinenceChallenge = challengeContext
    ? isAbstinenceChallenge(challengeContext.title, challengeContext.description)
    : false;

  // Camera-only capture. Gallery upload was removed in Phase 1.5-A as a basic
  // anti-cheat measure: galleries make it trivial to submit reused / staged
  // images. The user must capture proof in the moment with the rear camera.
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take proof photos.');
      return;
    }

    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: false,
      base64: true,
    });

    if (!res.canceled && res.assets[0]) {
      setPhotoUri(res.assets[0].uri);
      setPhotoBase64(res.assets[0].base64 ?? null);
      setResult(null);
    }
  };

  const submitProof = async () => {
    if (!photoUri || !challengeId || !session?.user) return;

    setVerifying(true);
    try {
      const challenge = await fetchChallengeById(challengeId);
      if (!challenge) throw new Error('Challenge not found');

      if (challenge.frequency === 'weekly') {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const todaySlot = getCompletionSlotKey(challenge.frequency, challenge.start_date, todayStr);
        const { data: weeklyRows, error: weeklyError } = await supabase
          .from('daily_proofs')
          .select('proof_date, is_verified')
          .eq('challenge_id', challenge.id)
          .eq('is_verified', true);
        if (weeklyError) throw weeklyError;

        const alreadySubmitted = (weeklyRows ?? []).some((row) =>
          getCompletionSlotKey(challenge.frequency, challenge.start_date, row.proof_date) === todaySlot,
        );
        if (alreadySubmitted) {
          Alert.alert('Already verified this week', 'Weekly challenges accept one verification per week.');
          setVerifying(false);
          return;
        }
      }

      // Client-side fast path: if the challenge's stored policy hard-
      // blocks photo verification, fail immediately without hitting the
      // edge function. The server enforces the same rule (verify-photo →
      // policyBlocksPhoto) so this is purely a UX optimization.
      const policyHardBlock = challenge.verification_policy?.hard_block_methods ?? [];
      if (Array.isArray(policyHardBlock) && policyHardBlock.includes('photo_ai')) {
        Alert.alert(
          t('verification.low_proof_blocked_title', {
            defaultValue: 'Verification Method Blocked',
          }),
          t('verification.low_proof_blocked_message', {
            defaultValue:
              'This challenge requires a different verification method. Please choose the recommended option.',
          }),
        );
        setVerifying(false);
        return;
      }

      // ImagePicker provides base64 directly via `base64: true` — this avoids
      // any expo-file-system round-trip, which has been unreliable in Expo Go.
      console.log('[verify-photo] base64 length', photoBase64?.length ?? 0);
      if (!photoBase64) {
        throw new Error('Photo has no base64 data. Please retake the photo.');
      }

      // Call AI verification edge function with base64 inline
      const { data: aiResult, error: aiError } = await supabase.functions.invoke(
        'verify-photo',
        {
          body: {
            challenge_id: challengeId,
            challenge_title: challenge.title,
            challenge_description: challenge.description,
            photo_base64: photoBase64,
            photo_media_type: 'image/jpeg',
            date: format(new Date(), 'yyyy-MM-dd'),
          },
        }
      );

      if (aiError) {
        console.error('[verify-photo] function invocation failed:', aiError);
        throw new Error(`AI verification failed: ${aiError.message}`);
      }
      const policyCode =
        typeof aiResult?.policy_code === 'string' ? aiResult.policy_code : '';
      const legacyError =
        typeof aiResult?.error === 'string' ? aiResult.error : '';
      const blocked = aiResult?.blocked === true;
      if (
        blocked ||
        policyCode === 'photo_verification_blocked_by_policy' ||
        policyCode === 'hydration_requires_healthkit' ||
        legacyError === 'hydration_requires_healthkit'
      ) {
        const message =
          typeof aiResult?.message === 'string'
            ? aiResult.message
            : "Hydration challenges can't be verified by photo. Please use Apple Health.";
        const alertTitle =
          policyCode === 'photo_verification_blocked_by_policy'
            ? 'Verification method blocked'
            : policyCode === 'hydration_requires_healthkit'
              ? 'Use Apple Health for hydration'
              : 'Verification blocked';
        Alert.alert(alertTitle, message);
        return;
      }
      if (legacyError) {
        console.error('[verify-photo] function returned error:', aiResult);
        throw new Error(
          `AI verification failed: ${legacyError}${aiResult.details ? ` - ${aiResult.details}` : ''}`,
        );
      }

      const verified = aiResult?.verified ?? false;
      const reasoning = aiResult?.reasoning ?? 'Verification pending.';
      // New structured fields from Phase 1.5-A. Both are optional — older
      // server deployments will simply omit them and the client falls back
      // to empty defaults.
      const missingEvidence: string[] = Array.isArray(aiResult?.missing_evidence)
        ? aiResult.missing_evidence.filter((x: unknown): x is string => typeof x === 'string')
        : [];
      const retryHint: string =
        typeof aiResult?.retry_hint === 'string' ? aiResult.retry_hint : '';

      setResult({ verified, reasoning, missingEvidence, retryHint });

      // Save proof to database. Use upsert on (challenge_id, proof_date) so
      // re-verification of a previously failed attempt overwrites the row
      // instead of hitting the unique constraint.
      const { error: proofError } = await supabase
        .from('daily_proofs')
        .upsert(
          {
            challenge_id: challengeId,
            user_id: session.user.id,
            proof_date: format(new Date(), 'yyyy-MM-dd'),
            verification_type: 'photo_ai',
            photo_url: null,
            proof_data: { ai_result: aiResult },
            ai_verification_result: verified,
            ai_verification_reasoning: reasoning,
            is_verified: verified,
          },
          { onConflict: 'challenge_id,proof_date' },
        );
      if (proofError) {
        console.error('[verify-photo] saving proof failed:', proofError);
        throw new Error(`Saving proof failed: ${proofError.message}`);
      }

      if (verified) {
        // Race-safe recompute: derive completed_days from verified proof
        // slots (day for daily challenges, week buckets for weekly ones).
        const { data: verifiedRows, error: countError } = await supabase
          .from('daily_proofs')
          .select('proof_date, is_verified')
          .eq('challenge_id', challenge.id)
          .eq('is_verified', true);

        if (!countError && verifiedRows) {
          const completedUnits = countVerifiedCompletions(challenge, verifiedRows);
          await supabase
            .from('challenges')
            .update({
              completed_days: completedUnits,
              updated_at: new Date().toISOString(),
            })
            .eq('id', challenge.id);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[verify-photo] submitProof error:', message);
      Alert.alert(t('common.error'), message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('verification.take_photo')}</Text>
        <Text style={styles.subtitle}>
          {abstinenceChallenge
            ? t('verification.abstinence_photo_instructions', {
                defaultValue:
                  'For abstinence challenges, submit a live selfie with your face visible as an intentional daily check-in.',
              })
            : t('verification.photo_instructions')}
        </Text>
      </View>

      <View style={styles.content}>
        {photoUri ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
            {result && (
              <Card
                style={[
                  styles.resultCard,
                  result.verified ? styles.resultSuccess : styles.resultFail,
                ]}
              >
                <Ionicons
                  name={result.verified ? 'checkmark-circle' : 'close-circle'}
                  size={28}
                  color={result.verified ? colors.success : colors.danger}
                />
                <Text style={styles.resultText}>
                  {result.verified ? t('verification.photo_verified') : t('verification.photo_rejected')}
                </Text>
                <Text style={styles.reasoningText}>{result.reasoning}</Text>
                {/* Phase 1.5-A: surface actionable retry hint when present
                    (most useful on rejection but harmless on success). */}
                {result.retryHint.length > 0 && (
                  <View style={styles.retryHintRow}>
                    <Ionicons name="bulb-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.retryHintText}>{result.retryHint}</Text>
                  </View>
                )}
              </Card>
            )}
          </View>
        ) : (
          <View style={styles.placeholderContainer}>
            <View style={styles.placeholder}>
              <Ionicons name="camera-outline" size={64} color={colors.textTertiary} />
              <Text style={styles.placeholderText}>No photo yet</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {!result && (
          <>
            {/* Camera-only capture (Phase 1.5-A anti-cheat). Gallery upload
                was removed — proof must be captured live. */}
            <View style={styles.photoButtons}>
              <Button
                title={photoUri ? 'Retake' : 'Take Photo'}
                onPress={takePhoto}
                variant={photoUri ? 'outline' : 'primary'}
                size="lg"
                fullWidth
                icon={
                  <Ionicons
                    name="camera"
                    size={20}
                    color={photoUri ? colors.textPrimary : colors.white}
                  />
                }
              />
            </View>
            {photoUri && (
              <View style={styles.submitSection}>
                <Button
                  title={t('verification.submit_proof')}
                  onPress={submitProof}
                  loading={verifying}
                  size="lg"
                  fullWidth
                />
              </View>
            )}
          </>
        )}
        {result && (
          <Button
            title={result.verified ? t('common.done') : t('common.retry')}
            onPress={() => {
              if (result.verified) {
                router.back();
              } else {
                setPhotoUri(null);
                setPhotoBase64(null);
                setResult(null);
              }
            }}
            size="lg"
            fullWidth
          />
        )}
        <View style={styles.spacer} />
        <Button
          title={t('common.cancel')}
          onPress={() => router.back()}
          variant="ghost"
          size="md"
        />
      </View>
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
  },
  title: {
    ...typography.title2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.subhead,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  previewContainer: {
    flex: 1,
  },
  preview: {
    width: '100%',
    height: 300,
    borderRadius: borderRadius.lg,
  },
  resultCard: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  resultSuccess: {
    backgroundColor: '#E8F5E9',
  },
  resultFail: {
    backgroundColor: '#FFEBEE',
  },
  resultText: {
    ...typography.headline,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  reasoningText: {
    ...typography.footnote,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  retryHintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  retryHintText: {
    ...typography.footnote,
    color: colors.textSecondary,
    flex: 1,
    fontStyle: 'italic',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  placeholder: {
    alignItems: 'center',
    padding: spacing.xxl,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.backgroundTertiary,
    borderStyle: 'dashed',
  },
  placeholderText: {
    ...typography.body,
    color: colors.textTertiary,
    marginTop: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  photoButtons: {
    width: '100%',
    marginBottom: spacing.md,
  },
  submitSection: {
    width: '100%',
  },
  spacer: {
    height: spacing.sm,
  },
});




