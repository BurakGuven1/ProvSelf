import { useState } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
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

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('common.error'), 'Please fill in all fields.');
      return;
    }
    try {
      await signIn(email.trim(), password);
    } catch {
      Alert.alert(t('common.error'), t('common.retry'));
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
          <View style={styles.header}>
            <Text style={styles.title}>{t('auth.sign_in')}</Text>
          </View>

          <View style={styles.form}>
            <Input
              label={t('auth.email')}
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.fieldSpacer} />
            <Input
              label={t('auth.password')}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
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
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.largeTitle,
    color: colors.textPrimary,
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
});
