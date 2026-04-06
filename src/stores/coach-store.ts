import { create } from 'zustand';
import { supabase } from '@/src/lib/supabase';
import type { CoachMessage } from '@/src/types/database';

interface CoachState {
  messages: CoachMessage[];
  unreadCount: number;
  loading: boolean;
  error: string | null;

  fetchMessages: () => Promise<void>;
  markAsRead: (messageId: string) => Promise<void>;
  clearError: () => void;
}

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export const useCoachStore = create<CoachState>((set, get) => ({
  messages: [],
  unreadCount: 0,
  loading: false,
  error: null,

  fetchMessages: async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('coach_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      const messages = (data ?? []) as CoachMessage[];
      set({
        messages,
        unreadCount: messages.filter((m) => !m.is_read).length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch messages';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  markAsRead: async (messageId) => {
    try {
      const { error } = await supabase
        .from('coach_messages')
        .update({ is_read: true })
        .eq('id', messageId);
      if (error) throw error;
      const messages = get().messages.map((m) =>
        m.id === messageId ? { ...m, is_read: true } : m,
      );
      set({
        messages,
        unreadCount: messages.filter((m) => !m.is_read).length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark as read';
      set({ error: message });
    }
  },

  clearError: () => set({ error: null }),
}));
