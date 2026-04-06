import { useState } from 'react';
import { View, Text, StyleSheet, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
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
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{ verified: boolean; reasoning: string } | null>(null);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take proof photos.');
      return;
    }

    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });

    if (!res.canceled && res.assets[0]) {
      setPhotoUri(res.assets[0].uri);
      setResult(null);
    }
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required.');
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });

    if (!res.canceled && res.assets[0]) {
      setPhotoUri(res.assets[0].uri);
      setResult(null);
    }
  };

  const submitProof = async () => {
    if (!photoUri || !challengeId || !session?.user) return;

    setVerifying(true);
    try {
      const challenge = await fetchChallengeById(challengeId);
      if (!challenge) throw new Error('Challenge not found');

      // Upload photo to Supabase Storage
      const fileName = `${session.user.id}/${challengeId}/${Date.now()}.jpg`;
      const response = await fetch(photoUri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('proof-photos')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      // Get public URL (even if upload fails in dev, continue with AI verification)
      const { data: urlData } = supabase.storage
        .from('proof-photos')
        .getPublicUrl(fileName);

      // Call AI verification edge function
      const { data: aiResult, error: aiError } = await supabase.functions.invoke(
        'verify-photo',
        {
          body: {
            challenge_id: challengeId,
            challenge_title: challenge.title,
            challenge_description: challenge.description,
            photo_url: urlData?.publicUrl,
            date: format(new Date(), 'yyyy-MM-dd'),
          },
        }
      );

      const verified = aiResult?.verified ?? false;
      const reasoning = aiResult?.reasoning ?? 'Verification pending.';

      setResult({ verified, reasoning });

      // Save proof to database
      await supabase.from('daily_proofs').insert({
        challenge_id: challengeId,
        user_id: session.user.id,
        proof_date: format(new Date(), 'yyyy-MM-dd'),
        verification_type: 'photo_ai',
        photo_url: urlData?.publicUrl,
        proof_data: { ai_result: aiResult },
        ai_verification_result: verified,
        ai_verification_reasoning: reasoning,
        is_verified: verified,
      });

      if (verified) {
        await supabase
          .from('challenges')
          .update({ completed_days: challenge.completed_days + 1 })
          .eq('id', challenge.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch {
      Alert.alert(t('common.error'), t('common.retry'));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('verification.take_photo')}</Text>
        <Text style={styles.subtitle}>{t('verification.photo_instructions')}</Text>
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
            <View style={styles.photoButtons}>
              <Button
                title="Camera"
                onPress={takePhoto}
                variant={photoUri ? 'outline' : 'primary'}
                size="lg"
                icon={<Ionicons name="camera" size={20} color={photoUri ? colors.textPrimary : colors.white} />}
              />
              <View style={{ width: spacing.md }} />
              <Button
                title="Library"
                onPress={pickPhoto}
                variant="outline"
                size="lg"
                icon={<Ionicons name="images" size={20} color={colors.textPrimary} />}
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
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  submitSection: {
    width: '100%',
  },
  spacer: {
    height: spacing.sm,
  },
});
