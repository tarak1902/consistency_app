import 'react-native-url-polyfill/auto';
import { createClient, processLock } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { config } from '@/lib/config';
import type { Database } from './database.types';
import { secureStorage } from './secureStorage';

// A placeholder URL keeps the client constructible when .env is missing; the
// sign-in screen shows a clear "not configured" message in that case.
export const supabase = createClient<Database>(
  config.supabaseUrl || 'http://127.0.0.1:54321',
  config.supabaseAnonKey || 'missing-anon-key',
  {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  },
);

// Refresh tokens only while the app is in the foreground (Supabase RN guidance).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
