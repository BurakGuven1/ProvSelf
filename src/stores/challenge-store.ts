import { create } from 'zustand';
import { supabase } from '@/src/lib/supabase';
import type { Challenge, ChallengeCategory, ChallengeFrequency, VerificationType, VerificationConfig } from '@/src/types/database';

interface CreateChallengeInput {
  title: string;
  description: string | null;
  category: ChallengeCategory;
  frequency: ChallengeFrequency;
  duration_days: number;
  required_completions: number;
  start_date: string;
  end_date: string;
  stake_cents: number;
  verification_type: VerificationType;
  verification_config: VerificationConfig | null;
  status: 'active';
  completed_days: number;
  failed_days: number;
}

interface ChallengeState {
  challenges: Challenge[];
  loading: boolean;
  error: string | null;

  fetchChallenges: () => Promise<void>;
  fetchChallengeById: (id: string) => Promise<Challenge | null>;
  createChallenge: (input: CreateChallengeInput) => Promise<Challenge>;
  updateChallenge: (id: string, updates: Partial<Challenge>) => Promise<void>;
  clearError: () => void;
}

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export const useChallengeStore = create<ChallengeState>((set, get) => ({
  challenges: [],
  loading: false,
  error: null,

  fetchChallenges: async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ challenges: (data ?? []) as Challenge[] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch challenges';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  fetchChallengeById: async (id) => {
    try {
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Challenge;
    } catch {
      return null;
    }
  },

  createChallenge: async (input) => {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('challenges')
        .insert({
          user_id: userId,
          ...input,
        })
        .select()
        .single();
      if (error) throw error;
      const challenge = data as Challenge;
      set({ challenges: [challenge, ...get().challenges] });
      return challenge;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create challenge';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  updateChallenge: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('challenges')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      const updated = data as Challenge;
      set({
        challenges: get().challenges.map((c) => (c.id === id ? updated : c)),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update challenge';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
