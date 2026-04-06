import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import { scheduleDailyReminder, cancelAllNotifications } from '@/src/lib/notifications';
import ScreenHeader from '@/src/components/ScreenHeader';

const KEYS = {
  dailyReminder: 'notif_daily_reminder',
  streakAlerts: 'notif_streak_alerts',
  coachMessages: 'notif_coach_messages',
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [dailyReminder, setDailyReminder] = useState(true);
  const [streakAlerts, setStreakAlerts] = useState(true);
  const [coachMessages, setCoachMessages] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    const [dr, sa, cm] = await Promise.all([
      AsyncStorage.getItem(KEYS.dailyReminder),
      AsyncStorage.getItem(KEYS.streakAlerts),
      AsyncStorage.getItem(KEYS.coachMessages),
    ]);
    if (dr !== null) setDailyReminder(dr === 'true');
    if (sa !== null) setStreakAlerts(sa === 'true');
    if (cm !== null) setCoachMessages(cm === 'true');
  };

  const toggleDailyReminder = async (value: boolean) => {
    setDailyReminder(value);
    await AsyncStorage.setItem(KEYS.dailyReminder, String(value));
    if (value) {
      await scheduleDailyReminder();
    } else {
      await cancelAllNotifications();
      // Re-schedule other notifications if needed
    }
  };

  const toggleStreakAlerts = async (value: boolean) => {
    setStreakAlerts(value);
    await AsyncStorage.setItem(KEYS.streakAlerts, String(value));
  };

  const toggleCoachMessages = async (value: boolean) => {
    setCoachMessages(value);
    await AsyncStorage.setItem(KEYS.coachMessages, String(value));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title={t('settings.notifications')}
        showBack
        onBack={() => router.back()}
      />

      <View style={styles.section}>
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.label}>Daily Reminders</Text>
            <Text style={styles.description}>Don't forget to verify your challenges</Text>
          </View>
          <Switch
            value={dailyReminder}
            onValueChange={toggleDailyReminder}
            trackColor={{ true: colors.accent }}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.label}>Streak Alerts</Text>
            <Text style={styles.description}>Celebrate your streaks</Text>
          </View>
          <Switch
            value={streakAlerts}
            onValueChange={toggleStreakAlerts}
            trackColor={{ true: colors.accent }}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.label}>AI Coach Messages</Text>
            <Text style={styles.description}>Get notified when your coach sends a message</Text>
          </View>
          <Switch
            value={coachMessages}
            onValueChange={toggleCoachMessages}
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
  rowContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  label: {
    ...typography.body,
    color: colors.textPrimary,
  },
  description: {
    ...typography.caption1,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
