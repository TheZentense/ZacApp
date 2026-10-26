import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { secureAuthStorage } from '@/lib/secureAuthStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const storage = Platform.OS === 'web' && typeof window === 'undefined'
  ? undefined
  : Platform.OS === 'android' ? secureAuthStorage : AsyncStorage;

export const isSupabaseConfigured = Boolean(url && anonKey);
export const supabase = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { storage, autoRefreshToken: Platform.OS !== 'android', persistSession: Boolean(storage), detectSessionInUrl: Platform.OS === 'web' }
    })
  : null;
