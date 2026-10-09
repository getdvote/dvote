/**
 * Settings from apps/dashboard/.env. VITE_* values are bundled into the page, so only public
 * values belong here (API URL, Supabase URL, PUBLISHABLE key — never a secret key).
 */
const clean = (v: string | undefined) => (v ?? '').trim().replace(/\/+$/, '');

export const config = {
  apiUrl: clean(import.meta.env.VITE_API_URL) || 'http://localhost:3000',
  supabaseUrl: clean(import.meta.env.VITE_SUPABASE_URL),
  supabasePublishableKey: clean(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
};

const missing = Object.entries({
  VITE_SUPABASE_URL: config.supabaseUrl,
  VITE_SUPABASE_PUBLISHABLE_KEY: config.supabasePublishableKey,
})
  .filter(([, v]) => !v)
  .map(([k]) => k);

/** null when everything is set; otherwise what to fix (shown instead of the app). */
export const configProblem: string | null = missing.length
  ? `Missing in apps/dashboard/.env: ${missing.join(', ')}. Fill it in (see .env.example) and restart "npm run dev".`
  : null;
