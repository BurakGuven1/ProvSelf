import { useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import ScreenHeader from '@/src/components/ScreenHeader';

export default function NotificationsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [dailyReminder, setDailyReminder] = useState(true);
  const [streakAlerts, setStreakAlerts] = useState(true);
  const [coachMessages, setCoachMessages] = useState(true);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title={t('settings.notifications')}
        showBack
        onBack={() => router.back()}
      />

      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.label}>Daily Reminders</Text>
          <Switch
            value={dailyReminder}
            onValueChange={setDailyReminder}
            trackColor={{ true: colors.accent }}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Streak Alerts</Text>
          <Switch
            value={streakAlerts}
            onValueChange={setStreakAlerts}
            trackColor={{ true: colors.accent }}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>AI Coach Messages</Text>
          <Switch
            value={coachMessages}
            onValueChange={setCoachMessages}
            trackColor={{ true: colors.accent }}
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
  section: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
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
  label: {
    ...typography.body,
    color: colors.textPrimary,
  },
});
