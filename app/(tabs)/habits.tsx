import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { addDays, format, startOfWeek } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';
import { getAllFollowRulePacks, getFollowRulePack, type RuleDifficulty } from '@/src/lib/follow-rules';
import { scheduleDailyReminder } from '@/src/lib/notifications';
import { useAuthStore } from '@/src/stores/auth-store';
import { useProgressStore } from '@/src/stores/progress-store';
import Button from '@/src/components/Button';
import Card from '@/src/components/Card';
import TokenPenaltyBanner from '@/src/components/TokenPenaltyBanner';

function buildWeekDates(reference = new Date()): string[] {
  const weekStart = startOfWeek(reference, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, index) => format(addDays(weekStart, index), 'yyyy-MM-dd'));
}

export default function TrackProgressScreen() {
  const router = useRouter();
  const { profile, session } = useAuthStore();
  const userId = profile?.id ?? session?.user?.id ?? null;
  const {
    selectedDifficulty,
    weeklyFocus,
    weeklyGoal,
    logs,
    reminderHour,
    reminderMinute,
    loading,
    loadedForUserId,
    loadProgress,
    setDifficulty,
    toggleTask,
    setTaskPhoto,
    setDayNote,
    setWeeklyPlan,
    setReminderTime,
  } = useProgressStore();

  const [weeklyFocusDraft, setWeeklyFocusDraft] = useState('');
  const [weeklyGoalDraft, setWeeklyGoalDraft] = useState('');
  const [todayNoteDraft, setTodayNoteDraft] = useState('');

  useEffect(() => {
    if (loadedForUserId !== userId) {
      loadProgress(userId);
    }
  }, [loadedForUserId, loadProgress, userId]);

  useEffect(() => {
    setWeeklyFocusDraft(weeklyFocus);
  }, [weeklyFocus]);

  useEffect(() => {
    setWeeklyGoalDraft(weeklyGoal);
  }, [weeklyGoal]);

  const packs = useMemo(() => getAllFollowRulePacks(), []);
  const activePack = useMemo(() => getFollowRulePack(selectedDifficulty), [selectedDifficulty]);
  const todayIso = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const weekDates = useMemo(() => buildWeekDates(), []);
  const todayLog = useMemo(() => logs.find((log) => log.date === todayIso) ?? null, [logs, todayIso]);

  useEffect(() => {
    setTodayNoteDraft(todayLog?.note ?? '');
  }, [todayLog?.note]);

  const completedToday = activePack.rules.filter((rule) => todayLog?.completions[rule.id]?.done).length;
  const todayProgress = activePack.rules.length > 0 ? completedToday / activePack.rules.length : 0;

  const weekStats = useMemo(
    () =>
      weekDates.map((dateIso) => {
        const dayLog = logs.find((log) => log.date === dateIso);
        const completed = activePack.rules.filter((rule) => dayLog?.completions[rule.id]?.done).length;
        return {
          dateIso,
          completed,
          total: activePack.rules.length,
        };
      }),
    [activePack.rules, logs, weekDates],
  );

  const galleryItems = useMemo(() => {
    const items: { key: string; date: string; title: string; uri: string }[] = [];
    logs.forEach((dayLog) => {
      activePack.rules.forEach((rule) => {
        const uri = dayLog.completions[rule.id]?.photo_uri;
        if (!uri) return;
        items.push({
          key: `${dayLog.date}-${rule.id}`,
          date: dayLog.date,
          title: rule.title,
          uri,
        });
      });
    });
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, [activePack.rules, logs]);

  const applyDifficulty = async (difficulty: RuleDifficulty) => {
    await setDifficulty(userId, difficulty);
  };

  const pickPhotoForRule = async (ruleId: string) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera required', 'Please allow camera permission to add a progress photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.65,
    });

    if (result.canceled || !result.assets[0]) return;
    await setTaskPhoto(userId, todayIso, ruleId, result.assets[0].uri);
  };

  const saveWeeklyPlan = async () => {
    await setWeeklyPlan(userId, {
      weeklyFocus: weeklyFocusDraft,
      weeklyGoal: weeklyGoalDraft,
    });
  };

  const saveTodayNote = async () => {
    await setDayNote(userId, todayIso, todayNoteDraft);
  };

  const handleReminderPreset = async (hour: number, minute: number) => {
    try {
      await setReminderTime(userId, hour, minute);
      await scheduleDailyReminder(hour, minute);
      Alert.alert('Reminder active', `Daily reminder is set for ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert('Reminder failed', message);
    }
  };

  const startPresetChallenge = () => {
    router.push({
      pathname: '/challenge/create',
      params: {
        templateTitle: activePack.createPreset.title,
        templateDescription: activePack.createPreset.description,
        templateCategory: activePack.createPreset.category,
        templateDifficulty: activePack.createPreset.difficulty,
        templateDuration: String(activePack.createPreset.durationDays),
        templateFrequency: 'daily',
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#0A46FF', '#071C66', '#050814']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroEyebrow}>Track Progress</Text>
          <Text style={styles.heroTitle}>Achieve your goals day by day ⚡</Text>
          <Text style={styles.heroSubtitle}>
            Photo or no-photo. Tick daily rules, monitor weekly rhythm, keep momentum.
          </Text>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{completedToday}/{activePack.rules.length}</Text>
              <Text style={styles.heroStatLabel}>Today</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{Math.round(todayProgress * 100)}%</Text>
              <Text style={styles.heroStatLabel}>Daily score</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{selectedDifficulty.toUpperCase()}</Text>
              <Text style={styles.heroStatLabel}>Mode</Text>
            </View>
          </View>
        </LinearGradient>

        <TokenPenaltyBanner />

        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Follow the rules</Text>
            <Text style={styles.sectionSubtitle}>{activePack.headline}</Text>
          </View>

          <View style={styles.segmented}>
            {packs.map((pack) => {
              const active = pack.id === selectedDifficulty;
              return (
                <TouchableOpacity
                  key={pack.id}
                  style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                  onPress={() => applyDifficulty(pack.id)}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{pack.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.rulesList}>
            {activePack.rules.map((rule) => {
              const completion = todayLog?.completions[rule.id];
              const isDone = completion?.done ?? false;
              const hasPhoto = Boolean(completion?.photo_uri);
              return (
                <View key={rule.id} style={styles.ruleRow}>
                  <TouchableOpacity style={styles.ruleTick} onPress={() => toggleTask(userId, todayIso, rule.id)}>
                    <View style={[styles.tickCircle, isDone && styles.tickCircleDone]}>
                      {isDone ? <Ionicons name="checkmark" size={15} color={colors.white} /> : null}
                    </View>
                  </TouchableOpacity>

                  <Text style={styles.ruleEmoji}>{rule.emoji}</Text>

                  <View style={styles.ruleContent}>
                    <Text style={styles.ruleTitle}>{rule.title}</Text>
                    {rule.subtitle ? <Text style={styles.ruleSubtitle}>{rule.subtitle}</Text> : null}
                  </View>

                  <TouchableOpacity
                    style={[styles.photoBtn, hasPhoto && styles.photoBtnActive]}
                    onPress={() => pickPhotoForRule(rule.id)}
                  >
                    <Ionicons name="camera" size={15} color={hasPhoto ? colors.white : colors.textSecondary} />
                    <Text style={[styles.photoBtnText, hasPhoto && styles.photoBtnTextActive]}>
                      {rule.requiresPhoto ? 'Photo' : hasPhoto ? 'Update' : 'Optional'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <Button title="Start Challenge" onPress={startPresetChallenge} fullWidth />
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Day by day / week by week plan</Text>
          <View style={styles.weekStrip}>
            {weekStats.map((day) => {
              const dayLabel = format(new Date(day.dateIso), 'EEE');
              const pct = day.total > 0 ? day.completed / day.total : 0;
              const isToday = day.dateIso === todayIso;
              return (
                <View key={day.dateIso} style={[styles.dayCell, isToday && styles.dayCellToday]}>
                  <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{dayLabel}</Text>
                  <Text style={[styles.dayValue, isToday && styles.dayLabelToday]}>{day.completed}/{day.total}</Text>
                  <View style={styles.dayBarBg}>
                    <View style={[styles.dayBarFill, { width: `${Math.round(pct * 100)}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Weekly focus</Text>
          <TextInput
            style={styles.fieldInput}
            value={weeklyFocusDraft}
            onChangeText={setWeeklyFocusDraft}
            placeholder="Example: Keep consistency and finish all daily tasks."
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.fieldLabel}>Weekly goal</Text>
          <TextInput
            style={styles.fieldInput}
            value={weeklyGoalDraft}
            onChangeText={setWeeklyGoalDraft}
            placeholder="Example: 7/7 rule completion + 5 workout photos."
            placeholderTextColor={colors.textTertiary}
          />

          <View style={styles.actionRow}>
            <Button title="Save weekly plan" onPress={saveWeeklyPlan} size="sm" />
          </View>

          <Text style={styles.fieldLabel}>Today note</Text>
          <TextInput
            style={[styles.fieldInput, styles.fieldInputLarge]}
            value={todayNoteDraft}
            onChangeText={setTodayNoteDraft}
            multiline
            textAlignVertical="top"
            placeholder="How did today go? What can be improved tomorrow?"
            placeholderTextColor={colors.textTertiary}
          />
          <View style={styles.actionRow}>
            <Button title="Save day note" onPress={saveTodayNote} size="sm" variant="outline" />
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Widget mode</Text>
          <Text style={styles.sectionSubtitle}>
            Quick-tick compact panel for daily tasks. Tap to confirm instantly.
          </Text>

          <View style={styles.widgetCard}>
            <View style={styles.widgetHeader}>
              <Text style={styles.widgetTitle}>Day {format(new Date(), 'd')}</Text>
              <Text style={styles.widgetCount}>{completedToday}/{activePack.rules.length}</Text>
            </View>

            <View style={styles.widgetGrid}>
              {activePack.rules.map((rule) => {
                const isDone = todayLog?.completions[rule.id]?.done ?? false;
                return (
                  <TouchableOpacity
                    key={`widget-${rule.id}`}
                    style={[styles.widgetItem, isDone && styles.widgetItemDone]}
                    onPress={() => toggleTask(userId, todayIso, rule.id)}
                  >
                    <Text style={styles.widgetItemEmoji}>{rule.emoji}</Text>
                    <Text numberOfLines={1} style={styles.widgetItemText}>
                      {rule.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Reminders</Text>
          <Text style={styles.sectionSubtitle}>
            Current reminder: {String(reminderHour).padStart(2, '0')}:{String(reminderMinute).padStart(2, '0')}
          </Text>
          <View style={styles.reminderRow}>
            <TouchableOpacity style={styles.reminderChip} onPress={() => handleReminderPreset(20, 30)}>
              <Text style={styles.reminderChipText}>20:30</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.reminderChip} onPress={() => handleReminderPreset(21, 0)}>
              <Text style={styles.reminderChipText}>21:00</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.reminderChip} onPress={() => handleReminderPreset(22, 0)}>
              <Text style={styles.reminderChipText}>22:00</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Progress gallery</Text>
          {galleryItems.length === 0 ? (
            <Text style={styles.emptyGallery}>No photo yet. Add your first progress shot today.</Text>
          ) : (
            <View style={styles.galleryGrid}>
              {galleryItems.map((item) => (
                <View key={item.key} style={styles.galleryItem}>
                  <Image source={{ uri: item.uri }} style={styles.galleryImage} />
                  <Text style={styles.galleryDate}>{format(new Date(item.date), 'MMM d')}</Text>
                  <Text numberOfLines={1} style={styles.galleryLabel}>{item.title}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {loading ? <Text style={styles.syncText}>Syncing progress...</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#040815',
  },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  hero: {
    borderRadius: 22,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    marginTop: spacing.sm,
  },
  heroEyebrow: {
    ...typography.caption1,
    color: '#8FC2FF',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    ...typography.title2,
    color: colors.white,
    marginTop: spacing.xs,
  },
  heroSubtitle: {
    ...typography.subhead,
    color: '#C3D9FF',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  heroStatCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
  },
  heroStatValue: {
    ...typography.headline,
    color: colors.white,
    fontWeight: '700',
  },
  heroStatLabel: {
    ...typography.caption2,
    color: '#A8C7FF',
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: '#0B1329',
    borderColor: '#1B2B4B',
  },
  sectionHeader: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.title3,
    color: '#F4F8FF',
  },
  sectionSubtitle: {
    ...typography.footnote,
    color: '#9CB2D8',
    marginTop: 4,
    lineHeight: 18,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#101C36',
    borderRadius: borderRadius.full,
    padding: 3,
    marginTop: spacing.sm,
  },
  segmentBtn: {
    flex: 1,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs + 3,
  },
  segmentBtnActive: {
    backgroundColor: '#D7E4FF',
  },
  segmentText: {
    ...typography.footnote,
    color: '#AEC6F1',
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#132140',
  },
  rulesList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111D39',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
  },
  ruleTick: {
    marginRight: spacing.xs,
  },
  tickCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#4C628D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickCircleDone: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  ruleEmoji: {
    fontSize: 20,
    marginHorizontal: spacing.xs,
  },
  ruleContent: {
    flex: 1,
  },
  ruleTitle: {
    ...typography.subhead,
    color: '#F2F7FF',
    fontWeight: '600',
  },
  ruleSubtitle: {
    ...typography.caption1,
    color: '#91A8CF',
    marginTop: 2,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0C172E',
    borderWidth: 1,
    borderColor: '#29416A',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  photoBtnActive: {
    backgroundColor: '#2F5BFF',
    borderColor: '#2F5BFF',
  },
  photoBtnText: {
    ...typography.caption2,
    color: '#9AB3DB',
    fontWeight: '700',
  },
  photoBtnTextActive: {
    color: colors.white,
  },
  weekStrip: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dayCell: {
    flex: 1,
    backgroundColor: '#111D39',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs + 3,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  dayCellToday: {
    borderWidth: 1.2,
    borderColor: '#56A3FF',
  },
  dayLabel: {
    ...typography.caption2,
    color: '#8FA8D3',
    fontWeight: '700',
  },
  dayLabelToday: {
    color: '#DAE8FF',
  },
  dayValue: {
    ...typography.caption1,
    color: '#D1E1FF',
    marginTop: 2,
  },
  dayBarBg: {
    width: '100%',
    height: 4,
    borderRadius: 3,
    backgroundColor: '#223556',
    marginTop: 5,
    overflow: 'hidden',
  },
  dayBarFill: {
    height: '100%',
    backgroundColor: '#4BA9FF',
  },
  fieldLabel: {
    ...typography.caption1,
    color: '#9FB6DA',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fieldInput: {
    backgroundColor: '#111D39',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#223C65',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    color: '#F4F8FF',
    ...typography.subhead,
  },
  fieldInputLarge: {
    minHeight: 88,
  },
  actionRow: {
    marginTop: spacing.sm,
    alignItems: 'flex-start',
  },
  widgetCard: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.lg,
    padding: spacing.sm + 2,
    backgroundColor: '#0A1024',
    borderWidth: 1,
    borderColor: '#2B4168',
  },
  widgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  widgetTitle: {
    ...typography.headline,
    color: '#EAF1FF',
  },
  widgetCount: {
    ...typography.headline,
    color: '#D8FF4D',
  },
  widgetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  widgetItem: {
    width: '48.8%',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#263D62',
    backgroundColor: '#121E3A',
    paddingVertical: spacing.xs + 3,
    paddingHorizontal: spacing.xs + 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  widgetItemDone: {
    backgroundColor: '#17345B',
    borderColor: '#4CA5FF',
  },
  widgetItemEmoji: {
    fontSize: 14,
  },
  widgetItemText: {
    ...typography.caption2,
    color: '#DBE8FF',
    flex: 1,
    fontWeight: '600',
  },
  reminderRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  reminderChip: {
    borderRadius: borderRadius.full,
    backgroundColor: '#111D39',
    borderWidth: 1,
    borderColor: '#274270',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
  },
  reminderChipText: {
    ...typography.footnote,
    color: '#D2E3FF',
    fontWeight: '700',
  },
  galleryGrid: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  galleryItem: {
    width: '31.5%',
  },
  galleryImage: {
    width: '100%',
    aspectRatio: 0.72,
    borderRadius: borderRadius.md,
    marginBottom: 5,
    backgroundColor: '#172540',
  },
  galleryDate: {
    ...typography.caption2,
    color: '#9FB6DA',
  },
  galleryLabel: {
    ...typography.caption2,
    color: '#D7E6FF',
    fontWeight: '600',
  },
  emptyGallery: {
    ...typography.footnote,
    color: '#9AB2D8',
    marginTop: spacing.sm,
  },
  syncText: {
    ...typography.caption1,
    color: '#8EA7CD',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
