import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export interface HabitItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  target_per_week: number;
  created_at: string;
  updated_at: string;
  completed_dates: string[];
}

interface HabitState {
  habits: HabitItem[];
  loading: boolean;
  loadedForUserId: string | null;
  error: string | null;

  loadHabits: (userId: string | null | undefined) => Promise<void>;
  addHabit: (
    userId: string | null | undefined,
    input: Pick<HabitItem, 'name' | 'icon' | 'color' | 'target_per_week'>,
  ) => Promise<void>;
  updateHabit: (
    userId: string | null | undefined,
    habitId: string,
    updates: Partial<Pick<HabitItem, 'name' | 'icon' | 'color' | 'target_per_week'>>,
  ) => Promise<void>;
  deleteHabit: (userId: string | null | undefined, habitId: string) => Promise<void>;
  toggleHabitDate: (userId: string | null | undefined, habitId: string, dateIso: string) => Promise<void>;
  clearError: () => void;
}

function storageKey(userId: string | null | undefined): string {
  return `provself_habits_${userId ?? 'guest'}`;
}

function ensureUniqueSortedDates(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function nowIso(): string {
  return new Date().toISOString();
}

function generateHabitId(): string {
  return `habit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function persistHabits(userId: string | null | undefined, habits: HabitItem[]) {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(habits));
}

function normalizeHabit(raw: unknown): HabitItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<HabitItem>;

  if (
    typeof item.id !== 'string' ||
    typeof item.name !== 'string' ||
    typeof item.icon !== 'string' ||
    typeof item.color !== 'string' ||
    typeof item.target_per_week !== 'number' ||
    typeof item.created_at !== 'string' ||
    typeof item.updated_at !== 'string' ||
    !Array.isArray(item.completed_dates)
  ) {
    return null;
  }

  const completedDates = ensureUniqueSortedDates(
    item.completed_dates.filter((value): value is string => typeof value === 'string'),
  );

  return {
    id: item.id,
    name: item.name,
    icon: item.icon,
    color: item.color,
    target_per_week: Math.min(7, Math.max(1, Math.floor(item.target_per_week))),
    created_at: item.created_at,
    updated_at: item.updated_at,
    completed_dates: completedDates,
  };
}

async function readHabits(userId: string | null | undefined): Promise<HabitItem[]> {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeHabit)
      .filter((item): item is HabitItem => item !== null);
  } catch {
    return [];
  }
}

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: [],
  loading: false,
  loadedForUserId: null,
  error: null,

  loadHabits: async (userId) => {
    set({ loading: true, error: null });
    try {
      const habits = await readHabits(userId);
      set({ habits, loadedForUserId: userId ?? null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load habits';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  addHabit: async (userId, input) => {
    set({ loading: true, error: null });
    try {
      const habits = get().habits;
      const now = nowIso();
      const nextHabit: HabitItem = {
        id: generateHabitId(),
        name: input.name.trim(),
        icon: input.icon,
        color: input.color,
        target_per_week: Math.min(7, Math.max(1, Math.floor(input.target_per_week))),
        created_at: now,
        updated_at: now,
        completed_dates: [],
      };

      const nextHabits = [nextHabit, ...habits];
      await persistHabits(userId, nextHabits);
      set({ habits: nextHabits, loadedForUserId: userId ?? null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add habit';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  updateHabit: async (userId, habitId, updates) => {
    set({ loading: true, error: null });
    try {
      const habits = get().habits;
      const nextHabits = habits.map((habit) =>
        habit.id === habitId
          ? {
              ...habit,
              ...updates,
              name: (updates.name ?? habit.name).trim(),
              target_per_week: Math.min(
                7,
                Math.max(1, Math.floor(updates.target_per_week ?? habit.target_per_week)),
              ),
              updated_at: nowIso(),
            }
          : habit,
      );

      await persistHabits(userId, nextHabits);
      set({ habits: nextHabits, loadedForUserId: userId ?? null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update habit';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  deleteHabit: async (userId, habitId) => {
    set({ loading: true, error: null });
    try {
      const nextHabits = get().habits.filter((habit) => habit.id !== habitId);
      await persistHabits(userId, nextHabits);
      set({ habits: nextHabits, loadedForUserId: userId ?? null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete habit';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  toggleHabitDate: async (userId, habitId, dateIso) => {
    set({ loading: true, error: null });
    try {
      const nextHabits = get().habits.map((habit) => {
        if (habit.id !== habitId) return habit;

        const exists = habit.completed_dates.includes(dateIso);
        const completedDates = exists
          ? habit.completed_dates.filter((date) => date !== dateIso)
          : [...habit.completed_dates, dateIso];

        return {
          ...habit,
          completed_dates: ensureUniqueSortedDates(completedDates),
          updated_at: nowIso(),
        };
      });

      await persistHabits(userId, nextHabits);
      set({ habits: nextHabits, loadedForUserId: userId ?? null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update completion';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
