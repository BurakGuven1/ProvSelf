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

export default function RegisterScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { signUp, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errors, setErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validate = () => {
    const newErrors: typeof errors = {};
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    if (!trimmedUsername) {
      newErrors.username = t('auth.errors.username_required');
    } else if (trimmedUsername.length < 3) {
      newErrors.username = t('auth.errors.username_short');
    } else if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      newErrors.username = t('auth.errors.username_invalid');
    }

    if (!trimmedEmail) {
      newErrors.email = t('auth.errors.email_required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = t('auth.errors.email_invalid');
    }

    if (!password) {
      newErrors.password = t('auth.errors.password_required');
    } else if (password.length < 6) {
      newErrors.password = t('auth.errors.password_short');
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = t('auth.errors.confirm_password_required');
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = t('auth.errors.passwords_mismatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validate()) return;
    try {
      await signUp(email.trim(), password, username.trim().toLowerCase());
      setShowConfirmation(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Sign up error:', message);
      if (message.includes('already registered')) {
        Alert.alert(t('common.error'), t('auth.errors.email_taken'));
      } else {
        Alert.alert(t('common.error'), message);
      }
    }
  };

  const clearError = (field: keyof typeof errors) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  if (showConfirmation) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.confirmationContainer}>
          <Text style={styles.confirmationIcon}>{'  '}</Text>
          <Text style={styles.confirmationTitle}>{t('auth.check_email')}</Text>
          <Text style={styles.confirmationText}>
            {t('auth.confirmation_sent', { email: email.trim() })}
          </Text>
          <View style={styles.confirmationActions}>
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
            <Text style={styles.title}>{t('auth.sign_up')}</Text>
            <Text style={styles.subtitle}>{t('auth.sign_up_subtitle')}</Text>
          </View>

          <View style={styles.form}>
            <Input
              label={t('auth.username')}
              placeholder={t('auth.choose_username')}
              value={username}
              onChangeText={(text) => { setUsername(text); clearError('username'); }}
              autoCapitalize="none"
              error={errors.username}
            />
            <View style={styles.fieldSpacer} />
            <Input
              label={t('auth.email')}
              placeholder="you@example.com"
              value={email}
              onChangeText={(text) => { setEmail(text); clearError('email'); }}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />
            <View style={styles.fieldSpacer} />
            <Input
              label={t('auth.password')}
              placeholder={t('auth.password_placeholder')}
              value={password}
              onChangeText={(text) => { setPassword(text); clearError('password'); }}
              secureTextEntry
              error={errors.password}
            />
            <View style={styles.fieldSpacer} />
            <Input
              label={t('auth.confirm_password')}
              placeholder={t('auth.confirm_password_placeholder')}
              value={confirmPassword}
              onChangeText={(text) => { setConfirmPassword(text); clearError('confirmPassword'); }}
              secureTextEntry
              error={errors.confirmPassword}
            />
          </View>

          <View style={styles.actions}>
            <Button
              title={t('auth.sign_up')}
              onPress={handleSignUp}
              loading={loading}
              size="lg"
              fullWidth
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>{t('auth.already_have_account')} </Text>
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
  },
  form: {
    marginBottom: spacing.xl,
  },
  fieldSpacer: {
    height: spacing.md,
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
  confirmationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  confirmationIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  confirmationTitle: {
    ...typography.title1,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  confirmationText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  confirmationActions: {
    width: '100%',
  },
});
