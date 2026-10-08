import Constants from 'expo-constants';

/**
 * Settings from apps/mobile/.env. EXPO_PUBLIC_* values are bundled into the app, so only
 * public values belong here (API URL, Supabase URL, PUBLISHABLE key — never a secret key).
 *
 * Missing values don't crash on import: they are listed in `configProblem`, and the root
 * layout shows a "Setup needed" screen instead of the app.
 */
const values = {
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};

const missing = Object.entries(values)
  .filter(([, v]) => !v?.trim())
  .map(([k]) => k);

/** null when everything is set; otherwise what to fix. */
export const configProblem: string | null = missing.length
  ? `Missing in apps/mobile/.env: ${missing.join(', ')}.\n\nFill it in, then restart Expo with:\nnpx expo start --port 8082 --clear`
  : null;

/**
 * On a phone "localhost" is the phone itself. During development Expo knows the PC the app
 * was loaded from (hostUri, e.g. "192.168.1.7:8082"), so a localhost API URL is pointed at
 * that PC. Production builds use the URL exactly as configured.
 */
function resolveApiUrl(url: string): string {
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (!devHost) return url;
  return url.replace(/\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/, `//${devHost}`);
}

const clean = (v: string | undefined) => (v ?? '').trim().replace(/\/+$/, '');

export const config = {
  apiUrl: resolveApiUrl(clean(values.EXPO_PUBLIC_API_URL)),
  // placeholders only keep createClient from throwing while "Setup needed" is shown
  supabaseUrl: clean(values.EXPO_PUBLIC_SUPABASE_URL) || 'https://not-configured.supabase.co',
  supabasePublishableKey: clean(values.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) || 'not-configured',
};
