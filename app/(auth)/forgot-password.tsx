import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing } from '@/src/constants/theme';
import { useAuthStore } from '@/src/stores/auth-store';
import Button from '@/src/components/Button';
import Input from '@/src/components/Input';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { resetPassword, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [sent, setSent] = useState(false);

  const validate = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError(t('auth.errors.email_required'));
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError(t('auth.errors.email_invalid'));
      return false;
    }
    setEmailError(undefined);
    return true;
  };

  const handleReset = async () => {
    if (!validate()) return;
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch {
      Alert.alert(t('common.error'), t('auth.errors.generic'));
    }
  };

  if (sent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.sentContainer}>
          <Text style={styles.sentIcon}>{'  '}</Text>
          <Text style={styles.sentTitle}>{t('auth.reset_email_sent')}</Text>
          <Text style={styles.sentText}>
            {t('auth.reset_email_sent_description', { email: email.trim() })}
          </Text>
          <View style={styles.sentActions}>
            <Button
              title={t('auth.go_to_login')}
              onPress={() => router.replace('/(auth)/login')}
              variant="primary"
              size="lg"
              fullWidth
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>{t('common.back')}</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>{t('auth.forgot_password')}</Text>
            <Text style={styles.subtitle}>{t('auth.forgot_password_subtitle')}</Text>
          </View>

          <View style={styles.form}>
            <Input
              label={t('auth.email')}
              placeholder="you@example.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) setEmailError(undefined);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              error={emailError}
            />
          </View>

          <View style={styles.actions}>
            <Button
              title={t('auth.send_reset_link')}
              onPress={handleReset}
              loading={loading}
              size="lg"
              fullWidth
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>{t('auth.remember_password')} </Text>
              <Text
                style={styles.switchLink}
                onPress={() => router.replace('/(auth)/login')}
              >
                {t('auth.sign_in')}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: spacing.md,
    left: 0,
    padding: spacing.sm,
  },
  backText: {
    ...typography.body,
    color: colors.accent,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.largeTitle,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  form: {
    marginBottom: spacing.xl,
  },
  actions: {},
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  switchText: {
    ...typography.subhead,
    color: colors.textSecondary,
  },
  switchLink: {
    ...typography.subhead,
    color: colors.accent,
    fontWeight: '600',
  },
  sentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  sentIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  sentTitle: {
    ...typography.title1,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  sentText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  sentActions: {
    width: '100%',
  },
});
