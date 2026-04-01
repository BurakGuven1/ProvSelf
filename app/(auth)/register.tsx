import { useState } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
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
  const [username, setUsername] = useState('');

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim() || !username.trim()) {
      Alert.alert(t('common.error'), 'Please fill in all fields.');
      return;
    }
    if (username.length < 3) {
      Alert.alert(t('common.error'), 'Username must be at least 3 characters.');
      return;
    }
    try {
      await signUp(email.trim(), password, username.trim().toLowerCase());
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
            <Text style={styles.title}>{t('auth.sign_up')}</Text>
          </View>

          <View style={styles.form}>
            <Input
              label={t('auth.username')}
              placeholder={t('auth.choose_username')}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <View style={styles.fieldSpacer} />
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
