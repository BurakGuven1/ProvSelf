import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { RuleDifficulty } from '@/src/lib/follow-rules';

export interface TaskCompletion {
  done: boolean;
  checked_at: string | null;
  photo_uri: string | null;
}

export interface DailyProgressLog {
  date: string; // yyyy-MM-dd
  note: string;
  completions: Record<string, TaskCompletion>;
}

interface ProgressSnapshot {
  selectedDifficulty: RuleDifficulty;
  weeklyFocus: string;
  weeklyGoal: string;
  reminderHour: number;
  reminderMinute: number;
  logs: DailyProgressLog[];
}

interface ProgressState extends ProgressSnapshot {
  loading: boolean;
  loadedForUserId: string | null;
  error: string | null;

  loadProgress: (userId: string | null | undefined) => Promise<void>;
  setDifficulty: (userId: string | null | undefined, difficulty: RuleDifficulty) => Promise<void>;
  toggleTask: (userId: string | null | undefined, date: string, taskId: string) => Promise<void>;
  setTaskPhoto: (
    userId: string | null | undefined,
    date: string,
    taskId: string,
    photoUri: string | null,
  ) => Promise<void>;
  setDayNote: (userId: string | null | undefined, date: string, note: string) => Promise<void>;
  setWeeklyPlan: (
    userId: string | null | undefined,
    updates: Pick<ProgressSnapshot, 'weeklyFocus' | 'weeklyGoal'>,
  ) => Promise<void>;
  setReminderTime: (
    userId: string | null | undefined,
    hour: number,
    minute: number,
  ) => Promise<void>;
  clearError: () => void;
}

function storageKey(userId: string | null | undefined): string {
  return `provself_progress_${userId ?? 'guest'}`;
}

function defaultSnapshot(): ProgressSnapshot {
  return {
    selectedDifficulty: 'medium',
    weeklyFocus: '',
    weeklyGoal: '',
    reminderHour: 21,
    reminderMinute: 0,
    logs: [],
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeTaskCompletion(raw: unknown): TaskCompletion | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<TaskCompletion>;
  if (typeof value.done !== 'boolean') return null;
  return {
    done: value.done,
    checked_at: typeof value.checked_at === 'string' ? value.checked_at : null,
    photo_uri: typeof value.photo_uri === 'string' ? value.photo_uri : null,
  };
}

function normalizeLog(raw: unknown): DailyProgressLog | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<DailyProgressLog>;
  if (typeof value.date !== 'string' || typeof value.note !== 'string') return null;
  if (!value.completions || typeof value.completions !== 'object') return null;

  const normalized: Record<string, TaskCompletion> = {};
  Object.entries(value.completions).forEach(([taskId, completion]) => {
    const taskCompletion = normalizeTaskCompletion(completion);
    if (taskCompletion) {
      normalized[taskId] = taskCompletion;
    }
  });

  return {
    date: value.date,
    note: value.note,
    completions: normalized,
  };
}

function normalizeSnapshot(raw: unknown): ProgressSnapshot {
  const fallback = defaultSnapshot();
  if (!raw || typeof raw !== 'object') return fallback;
  const value = raw as Partial<ProgressSnapshot>;

  const selectedDifficulty =
    value.selectedDifficulty === 'soft' || value.selectedDifficulty === 'medium' || value.selectedDifficulty === 'hard'
      ? value.selectedDifficulty
      : fallback.selectedDifficulty;

  const logs = Array.isArray(value.logs)
    ? value.logs
        .map(normalizeLog)
        .filter((entry): entry is DailyProgressLog => entry !== null)
        .sort((a, b) => a.date.localeCompare(b.date))
    : fallback.logs;

  return {
    selectedDifficulty,
    weeklyFocus: typeof value.weeklyFocus === 'string' ? value.weeklyFocus : fallback.weeklyFocus,
    weeklyGoal: typeof value.weeklyGoal === 'string' ? value.weeklyGoal : fallback.weeklyGoal,
    reminderHour:
      typeof value.reminderHour === 'number'
        ? Math.min(23, Math.max(0, Math.floor(value.reminderHour)))
        : fallback.reminderHour,
    reminderMinute:
      typeof value.reminderMinute === 'number'
        ? Math.min(59, Math.max(0, Math.floor(value.reminderMinute)))
        : fallback.reminderMinute,
    logs,
  };
}

async function readSnapshot(userId: string | null | undefined): Promise<ProgressSnapshot> {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  if (!raw) return defaultSnapshot();
  try {
    return normalizeSnapshot(JSON.parse(raw));
  } catch {
    return defaultSnapshot();
  }
}

async function persistSnapshot(userId: string | null | undefined, snapshot: ProgressSnapshot): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(snapshot));
}

function upsertLog(logs: DailyProgressLog[], date: string, mutate: (existing: DailyProgressLog) => DailyProgressLog): DailyProgressLog[] {
  let found = false;
  const next = logs.map((log) => {
    if (log.date !== date) return log;
    found = true;
    return mutate(log);
  });

  if (found) return next.sort((a, b) => a.date.localeCompare(b.date));

  const created: DailyProgressLog = mutate({
    date,
    note: '',
    completions: {},
  });
  return [...next, created].sort((a, b) => a.date.localeCompare(b.date));
}

export const useProgressStore = create<ProgressState>((set, get) => ({
  ...defaultSnapshot(),
  loading: false,
  loadedForUserId: null,
  error: null,

  loadProgress: async (userId) => {
    set({ loading: true, error: null });
    try {
      const snapshot = await readSnapshot(userId);
      set({
        ...snapshot,
        loadedForUserId: userId ?? null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load progress';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  setDifficulty: async (userId, difficulty) => {
    set({ loading: true, error: null });
    try {
      const snapshot: ProgressSnapshot = {
        selectedDifficulty: difficulty,
        weeklyFocus: get().weeklyFocus,
        weeklyGoal: get().weeklyGoal,
        reminderHour: get().reminderHour,
        reminderMinute: get().reminderMinute,
        logs: get().logs,
      };
      await persistSnapshot(userId, snapshot);
      set({
        selectedDifficulty: snapshot.selectedDifficulty,
        loadedForUserId: userId ?? null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update rules';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  toggleTask: async (userId, date, taskId) => {
    set({ loading: true, error: null });
    try {
      const logs = upsertLog(get().logs, date, (existing) => {
        const current = existing.completions[taskId];
        const nextDone = !(current?.done ?? false);
        return {
          ...existing,
          completions: {
            ...existing.completions,
            [taskId]: {
              done: nextDone,
              checked_at: nextDone ? nowIso() : null,
              photo_uri: current?.photo_uri ?? null,
            },
          },
        };
      });

      const snapshot: ProgressSnapshot = {
        selectedDifficulty: get().selectedDifficulty,
        weeklyFocus: get().weeklyFocus,
        weeklyGoal: get().weeklyGoal,
        reminderHour: get().reminderHour,
        reminderMinute: get().reminderMinute,
        logs,
      };
      await persistSnapshot(userId, snapshot);
      set({ logs, loadedForUserId: userId ?? null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update task';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  setTaskPhoto: async (userId, date, taskId, photoUri) => {
    set({ loading: true, error: null });
    try {
      const logs = upsertLog(get().logs, date, (existing) => {
        const current = existing.completions[taskId];
        return {
          ...existing,
          completions: {
            ...existing.completions,
            [taskId]: {
              done: current?.done ?? false,
              checked_at: current?.checked_at ?? null,
              photo_uri: photoUri,
            },
          },
        };
      });

      const snapshot: ProgressSnapshot = {
        selectedDifficulty: get().selectedDifficulty,
        weeklyFocus: get().weeklyFocus,
        weeklyGoal: get().weeklyGoal,
        reminderHour: get().reminderHour,
        reminderMinute: get().reminderMinute,
        logs,
      };
      await persistSnapshot(userId, snapshot);
      set({ logs, loadedForUserId: userId ?? null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save photo';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  setDayNote: async (userId, date, note) => {
    set({ loading: true, error: null });
    try {
      const logs = upsertLog(get().logs, date, (existing) => ({
        ...existing,
        note: note.trim(),
      }));

      const snapshot: ProgressSnapshot = {
        selectedDifficulty: get().selectedDifficulty,
        weeklyFocus: get().weeklyFocus,
        weeklyGoal: get().weeklyGoal,
        reminderHour: get().reminderHour,
        reminderMinute: get().reminderMinute,
        logs,
      };
      await persistSnapshot(userId, snapshot);
      set({ logs, loadedForUserId: userId ?? null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save note';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  setWeeklyPlan: async (userId, updates) => {
    set({ loading: true, error: null });
    try {
      const snapshot: ProgressSnapshot = {
        selectedDifficulty: get().selectedDifficulty,
        weeklyFocus: updates.weeklyFocus.trim(),
        weeklyGoal: updates.weeklyGoal.trim(),
        reminderHour: get().reminderHour,
        reminderMinute: get().reminderMinute,
        logs: get().logs,
      };
      await persistSnapshot(userId, snapshot);
      set({
        weeklyFocus: snapshot.weeklyFocus,
        weeklyGoal: snapshot.weeklyGoal,
        loadedForUserId: userId ?? null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save weekly plan';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  setReminderTime: async (userId, hour, minute) => {
    set({ loading: true, error: null });
    try {
      const snapshot: ProgressSnapshot = {
        selectedDifficulty: get().selectedDifficulty,
        weeklyFocus: get().weeklyFocus,
        weeklyGoal: get().weeklyGoal,
        reminderHour: Math.min(23, Math.max(0, Math.floor(hour))),
        reminderMinute: Math.min(59, Math.max(0, Math.floor(minute))),
        logs: get().logs,
      };
      await persistSnapshot(userId, snapshot);
      set({
        reminderHour: snapshot.reminderHour,
        reminderMinute: snapshot.reminderMinute,
        loadedForUserId: userId ?? null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save reminder';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));

