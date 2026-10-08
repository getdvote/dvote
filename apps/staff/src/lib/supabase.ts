import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { config } from './config';

/**
 * Staff sign in with email + password through Supabase Auth. The session is kept in
 * AsyncStorage on phones and localStorage on the web, and refreshed automatically.
 */
export const supabase = createClient(
  config.supabaseUrl,
  config.supabasePublishableKey,
  {
    auth: {
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      storageKey: 'dvote-staff-auth',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// On phones, only refresh the token while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
