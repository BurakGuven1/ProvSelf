import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing } from '@/src/constants/theme';
import Button from '@/src/components/Button';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.logo}>PROVSELF</Text>
          <Text style={styles.title}>{t('auth.welcome_title')}</Text>
          <Text style={styles.subtitle}>{t('auth.welcome_subtitle')}</Text>
        </View>

        <View style={styles.actions}>
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
});
