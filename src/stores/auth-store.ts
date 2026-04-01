import { create } from 'zustand';
import { supabase } from '@/src/lib/supabase';
import type { Profile } from '@/src/types/database';
import type { Session } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;

  setSession: (session: Session | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<Profile, 'display_name' | 'avatar_url' | 'locale' | 'timezone'>>) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  loading: false,
  error: null,

  setSession: (session) => set({ session }),

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      set({ session: data.session });
      await get().fetchProfile();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  signUp: async (email, password, username) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (error) throw error;
      set({ session: data.session });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      set({ session: null, profile: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign out failed';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  fetchProfile: async () => {
    const userId = get().session?.user?.id;
    if (!userId) return;

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      set({ profile: data as Profile });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch profile';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  updateProfile: async (updates) => {
    const userId = get().session?.user?.id;
    if (!userId) return;

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
      set({ profile: data as Profile });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
