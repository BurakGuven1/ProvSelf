import { create } from 'zustand';
import { getCustomerInfo, isProSubscriber, restorePurchases } from '@/src/lib/revenue-cat';

interface SubscriptionState {
  isPro: boolean;
  loading: boolean;

  checkSubscription: () => Promise<void>;
  restore: () => Promise<boolean>;
  reset: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  isPro: false,
  loading: false,

  checkSubscription: async () => {
    set({ loading: true });
    try {
      const info = await getCustomerInfo();
      set({ isPro: isProSubscriber(info) });
    } catch {
      // Non-critical — keep current state
    } finally {
      set({ loading: false });
    }
  },

  restore: async () => {
    set({ loading: true });
    try {
      const info = await restorePurchases();
      const pro = isProSubscriber(info);
      set({ isPro: pro });
      return pro;
    } catch {
      return false;
    } finally {
      set({ loading: false });
    }
  },

  reset: () => set({ isPro: false, loading: false }),
}));
