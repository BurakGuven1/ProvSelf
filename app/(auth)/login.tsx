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

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { signIn, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      newErrors.email = t('auth.errors.email_required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = t('auth.errors.email_invalid');
    }

    if (!password) {
      newErrors.password = t('auth.errors.password_required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    if (!validate()) return;
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('Invalid login credentials')) {
        Alert.alert(t('common.error'), t('auth.errors.invalid_credentials'));
      } else {
        Alert.alert(t('common.error'), t('auth.errors.generic'));
      }
    }
  };

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
            <Text style={styles.title}>{t('auth.sign_in')}</Text>
            <Text style={styles.subtitle}>{t('auth.sign_in_subtitle')}</Text>
          </View>

          <View style={styles.form}>
            <Input
              label={t('auth.email')}
              placeholder="you@example.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />
            <View style={styles.fieldSpacer} />
            <Input
              label={t('auth.password')}
              placeholder="••••••••"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              secureTextEntry
              error={errors.password}
            />
            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot-password')}
              style={styles.forgotButton}
            >
              <Text style={styles.forgotText}>{t('auth.forgot_password')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actions}>
            <Button
              title={t('auth.sign_in')}
              onPress={handleSignIn}
              loading={loading}
              size="lg"
              fullWidth
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>{t('auth.dont_have_account')} </Text>
              <Text
                style={styles.switchLink}
                onPress={() => router.replace('/(auth)/register')}
              >
                {t('auth.sign_up')}
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
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: spacing.sm,
    padding: spacing.xs,
  },
  forgotText: {
    ...typography.subhead,
    color: colors.accent,
    fontWeight: '500',
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
});
