import { createClient } from '@supabase/supabase-js';
import { config } from './config';

/** Sign-in only (password + authenticator app). The data comes from the dvote API, never from Supabase. */
export const supabase = createClient(
  config.supabaseUrl || 'https://not-configured.supabase.co',
  config.supabasePublishableKey || 'not-configured',
  { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'dvote-dashboard-auth' } },
);
