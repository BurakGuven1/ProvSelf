import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import { useAuthStore } from '@/src/stores/auth-store';
import { restorePurchases } from '@/src/lib/revenue-cat';
import ScreenHeader from '@/src/components/ScreenHeader';
import Button from '@/src/components/Button';

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  value?: string;
  destructive?: boolean;
}

function SettingsRow({ icon, label, onPress, value, destructive }: SettingsRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.6}>
      <View style={styles.rowLeft}>
        <Ionicons
          name={icon}
          size={22}
          color={destructive ? colors.danger : colors.textPrimary}
        />
        <Text style={[styles.rowLabel, destructive && { color: colors.danger }]}>
          {label}
        </Text>
      </View>
      <View style={styles.rowRight}>
        {value && <Text style={styles.rowValue}>{value}</Text>}
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { signOut, loading } = useAuthStore();
  const [restoring, setRestoring] = useState(false);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const handleRestorePurchases = async () => {
    setRestoring(true);
    try {
      const customerInfo = await restorePurchases();
      const hasActive = Object.keys(customerInfo.entitlements.active).length > 0;
      if (hasActive) {
        Alert.alert(t('settings.restore_purchases'), 'Your purchases have been restored successfully.');
      } else {
        Alert.alert(t('settings.restore_purchases'), 'No previous purchases found.');
      }
    } catch {
      Alert.alert(t('common.error'), t('common.retry'));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title={t('settings.title')}
        showBack
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <SettingsRow
            icon="language"
            label={t('settings.language')}
            onPress={() => router.push('/settings/language')}
          />
          <SettingsRow
            icon="notifications-outline"
            label={t('settings.notifications')}
            onPress={() => router.push('/settings/notifications')}
          />
          <SettingsRow
            icon="star-outline"
            label={t('settings.subscription')}
            onPress={() => router.push('/settings/subscription')}
          />
        </View>

        <View style={styles.section}>
          <SettingsRow
            icon="shield-outline"
            label={t('settings.privacy_policy')}
            onPress={() => router.push('/settings/privacy')}
          />
          <SettingsRow
            icon="document-text-outline"
            label={t('settings.terms')}
            onPress={() => router.push('/settings/terms')}
          />
        </View>

        <View style={styles.section}>
          <SettingsRow
            icon="refresh-outline"
            label={restoring ? 'Restoring...' : t('settings.restore_purchases')}
            onPress={handleRestorePurchases}
          />
        </View>

        <View style={styles.signOutSection}>
          <Button
            title={t('auth.sign_out')}
            onPress={signOut}
            variant="danger"
            loading={loading}
            fullWidth
          />
        </View>

        <Text style={styles.version}>
          {t('settings.version', { version })}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  section: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.backgroundTertiary,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowLabel: {
    ...typography.body,
    color: colors.textPrimary,
    marginLeft: spacing.md,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowValue: {
    ...typography.subhead,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  signOutSection: {
    marginTop: spacing.md,
  },
  version: {
    ...typography.caption1,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
