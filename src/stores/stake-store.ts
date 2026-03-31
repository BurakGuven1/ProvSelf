import { create } from 'zustand';
import { supabase } from '@/src/lib/supabase';
import type { StakeBalance } from '@/src/types/database';

interface StakeState {
  balance: StakeBalance | null;
  loading: boolean;
  error: string | null;

  fetchBalance: () => Promise<void>;
  deductStake: (amountCents: number) => Promise<void>;
  returnStake: (amountCents: number) => Promise<void>;
  clearError: () => void;
}

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export const useStakeStore = create<StakeState>((set, get) => ({
  balance: null,
  loading: false,
  error: null,

  fetchBalance: async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('stake_balances')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // No row found — create initial balance
        const { data: newData, error: insertError } = await supabase
          .from('stake_balances')
          .insert({ user_id: userId, balance_cents: 0 })
          .select()
          .single();
        if (insertError) throw insertError;
        set({ balance: newData as StakeBalance });
      } else if (error) {
        throw error;
      } else {
        set({ balance: data as StakeBalance });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch balance';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  deductStake: async (amountCents) => {
    const current = get().balance;
    if (!current) throw new Error('No balance loaded');
    if (current.balance_cents < amountCents) throw new Error('Insufficient balance');

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('stake_balances')
        .update({
          balance_cents: current.balance_cents - amountCents,
          updated_at: new Date().toISOString(),
        })
        .eq('id', current.id)
        .select()
        .single();
      if (error) throw error;
      set({ balance: data as StakeBalance });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to deduct stake';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  returnStake: async (amountCents) => {
    const current = get().balance;
    if (!current) throw new Error('No balance loaded');

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('stake_balances')
        .update({
          balance_cents: current.balance_cents + amountCents,
          total_returned_cents: current.total_returned_cents + amountCents,
          updated_at: new Date().toISOString(),
        })
        .eq('id', current.id)
        .select()
        .single();
      if (error) throw error;
      set({ balance: data as StakeBalance });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to return stake';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
