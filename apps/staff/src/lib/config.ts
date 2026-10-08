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

export const config = {
  apiUrl: required('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL),
  supabaseUrl: required(
    'EXPO_PUBLIC_SUPABASE_URL',
    process.env.EXPO_PUBLIC_SUPABASE_URL,
  ),
  supabasePublishableKey: required(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
};
