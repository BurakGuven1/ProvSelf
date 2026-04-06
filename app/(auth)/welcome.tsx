import { View, Text, StyleSheet, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing } from '@/src/constants/theme';
import { useAuthStore } from '@/src/stores/auth-store';
import Button from '@/src/components/Button';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { signInWithApple, loading } = useAuthStore();

  const handleAppleSignIn = async () => {
    try {
      await signInWithApple();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Apple Sign In failed';
      Alert.alert(t('common.error'), message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.logo}>PROVSELF</Text>
          <Text style={styles.title}>{t('auth.welcome_title')}</Text>
          <Text style={styles.subtitle}>{t('auth.welcome_subtitle')}</Text>
        </View>

        <View style={styles.actions}>
          {Platform.OS === 'ios' && (
            <>
              <Button
                title={t('auth.continue_with_apple')}
                onPress={handleAppleSignIn}
                loading={loading}
                variant="secondary"
                size="lg"
                fullWidth
                icon={<Ionicons name="logo-apple" size={20} color={colors.white} />}
              />
              <View style={styles.spacer} />
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('auth.or')}</Text>
                <View style={styles.dividerLine} />
              </View>
              <View style={styles.spacer} />
            </>
          )}
          <Button
            title={t('auth.sign_in')}
            onPress={() => router.push('/(auth)/login')}
            variant="primary"
            size="lg"
            fullWidth
          />
          <View style={styles.spacer} />
          <Button
            title={t('auth.sign_up')}
            onPress={() => router.push('/(auth)/register')}
            variant="outline"
            size="lg"
            fullWidth
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
    paddingBottom: spacing.xl,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    ...typography.caption1,
    fontWeight: '700',
    letterSpacing: 6,
    color: colors.secondary,
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.largeTitle,
    textAlign: 'center',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    lineHeight: 24,
  },
  actions: {
    paddingTop: spacing.xl,
  },
  spacer: {
    height: spacing.md,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.textTertiary,
  },
  dividerText: {
    ...typography.footnote,
    color: colors.textTertiary,
    paddingHorizontal: spacing.md,
  },
});
