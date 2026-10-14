import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const storage = Platform.OS === 'web' && typeof window === 'undefined' ? undefined : AsyncStorage;

export const isSupabaseConfigured = Boolean(url && anonKey);
export const supabase = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { storage, autoRefreshToken: true, persistSession: Boolean(storage), detectSessionInUrl: false }
    })
  : null;
