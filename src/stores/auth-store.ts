import { Platform } from 'react-native';
import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
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
  signInWithApple: () => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<Profile, 'username' | 'display_name' | 'avatar_url' | 'locale' | 'timezone'>>) => Promise<void>;
  clearError: () => void;
}

function sanitizeUsername(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (normalized.length < 3) return null;
  return normalized.slice(0, 24);
}

function buildUsernameCandidates(userId: string, metadataUsername: unknown): string[] {
  const fallback = `user_${userId.slice(0, 8)}`;
  const sanitized = sanitizeUsername(metadataUsername);
  const candidates = [
    sanitized,
    sanitized ? `${sanitized}_${userId.slice(0, 4)}` : null,
    fallback,
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(candidates));
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  loading: false,
  error: null,

  setSession: (session) => set({ session }),

  signInWithApple: async () => {
    if (Platform.OS !== 'ios') return;

    set({ loading: true, error: null });
    try {
      // Lazy-load to avoid crash on Android / Expo Go
      const AppleAuthentication = await import('expo-apple-authentication');
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Apple Sign In is not available on this device');
      }

      const rawNonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        throw new Error('No identity token returned from Apple');
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });
      if (error) throw error;

      set({ session: data.session });
      if (data.session) {
        await get().fetchProfile();
      }
    } catch (err) {
      // User cancelled — don't surface as error
      if ((err as any)?.code === 'ERR_REQUEST_CANCELED') {
        set({ loading: false });
        return;
      }
      const message = err instanceof Error ? err.message : 'Apple Sign In failed';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

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
      if (data.session) {
        await get().fetchProfile();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  resetPassword: async (email) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email';
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
    set({ loading: true, error: null });
    try {
      let activeSession = get().session;
      if (!activeSession) {
        const { data: sessionData } = await supabase.auth.getSession();
        activeSession = sessionData.session;
        if (activeSession) {
          set({ session: activeSession });
        }
      }

      const userId = activeSession?.user?.id;
      if (!userId) {
        // Don't surface "Auth session missing" as a fatal UI error on startup races.
        set({ profile: null, error: null });
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;

      if (data) {
        set({ profile: data as Profile });
        return;
      }

      const usernameCandidates = buildUsernameCandidates(
        userId,
        activeSession?.user?.user_metadata?.username,
      );

      for (const usernameCandidate of usernameCandidates) {
        const { data: created, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            username: usernameCandidate,
            display_name: usernameCandidate,
            locale: 'en',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          })
          .select('*')
          .single();

        if (!insertError && created) {
          set({ profile: created as Profile });
          return;
        }

        const alreadyExists = insertError?.code === '23505';
        if (alreadyExists) {
          const { data: existing, error: existingError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
          if (!existingError && existing) {
            set({ profile: existing as Profile });
            return;
          }
          continue;
        }

        throw insertError;
      }

      throw new Error('Failed to create profile');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch profile';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  updateProfile: async (updates) => {
    let userId: string | undefined = get().session?.user?.id;
    if (!userId) {
      const { data } = await supabase.auth.getSession();
      userId = data.session?.user?.id ?? undefined;
      if (data.session) {
        set({ session: data.session });
      }
    }
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
