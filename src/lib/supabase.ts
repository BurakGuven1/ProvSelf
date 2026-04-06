import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStoreCompat from './secure-store';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl ?? 'https://placeholder.supabase.co';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey ?? 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreCompat,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
