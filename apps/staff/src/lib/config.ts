import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Settings from apps/staff/.env (EXPO_PUBLIC_* values are bundled into the app, so only
 * public values belong here: the API URL, the Supabase URL and the PUBLISHABLE key —
 * never the Supabase secret key).
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy apps/staff/.env.example to apps/staff/.env and fill it in, then restart Expo.`,
    );
  }
  return value.replace(/\/+$/, '');
}

/**
 * On a phone, "localhost" is the phone itself. During development (Expo Go / dev build)
 * Expo knows the PC it loaded the app from (`hostUri`, e.g. "192.168.1.7:8081"), so a
 * localhost API URL is pointed at that PC instead — it keeps working when the PC's Wi-Fi
 * address changes. Web and production builds use the URL exactly as configured.
 */
function resolveApiUrl(url: string): string {
  if (Platform.OS === 'web') return url;
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (!devHost) return url;
  return url.replace(/\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/, `//${devHost}`);
}

export const config = {
  apiUrl: resolveApiUrl(
    required('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL),
  ),
  supabaseUrl: required(
    'EXPO_PUBLIC_SUPABASE_URL',
    process.env.EXPO_PUBLIC_SUPABASE_URL,
  ),
  supabasePublishableKey: required(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
};
