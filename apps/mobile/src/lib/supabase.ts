import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { config } from './config';

/**
 * Customer sign-in (Google, Facebook, email + password) through Supabase Auth.
 * PKCE: browser sign-ins and email links come back to the app with a one-time `code`
 * that only this device (which holds the verifier) can exchange for a session.
 */
export const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    storageKey: 'dvote-customer-auth',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// Only refresh the token while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') void supabase.auth.startAutoRefresh();
  else void supabase.auth.stopAutoRefresh();
});
