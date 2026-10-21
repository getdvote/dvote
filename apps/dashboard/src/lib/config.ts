/**
 * Settings from apps/dashboard/.env. VITE_* values are bundled into the page, so only public
 * values belong here (API URL, Supabase URL, PUBLISHABLE key — never a secret key).
 */
const clean = (v: string | undefined) => (v ?? '').trim().replace(/\/+$/, '');

export const config = {
  apiUrl: clean(import.meta.env.VITE_API_URL) || 'http://localhost:3000',
  /** The customer website (apps/web, m.dvote.co): each shop's page is <webUrl>/<slug>. */
  webUrl: clean(import.meta.env.VITE_WEB_URL) || 'http://localhost:5174',
  /** This same app as the admin dashboard (admin.dvote.co) and the merchant dashboard (merchant.dvote.co). */
  adminUrl: clean(import.meta.env.VITE_ADMIN_URL),
  /** The landing page (pricing for trial shops). */
  landingUrl: clean(import.meta.env.VITE_LANDING_URL) || 'https://dvote.co',
  /** Cloudflare Turnstile site key (public) for the sign-up captcha; empty = no captcha (development). */
  turnstileSiteKey: clean(import.meta.env.VITE_TURNSTILE_SITE_KEY),
  merchantUrl: clean(import.meta.env.VITE_MERCHANT_URL),
  supabaseUrl: clean(import.meta.env.VITE_SUPABASE_URL),
  supabasePublishableKey: clean(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
};

const sameOrigin = (url: string) => {
  try {
    return !!url && new URL(url).origin === window.location.origin;
  } catch {
    return false;
  }
};

/**
 * Which dashboard this address is. One build serves both: admin.dvote.co only lets platform
 * admins in, merchant.dvote.co only merchant accounts (router.tsx shows the way to the other one).
 * 'any' = neither address (local development, previews): everyone, as before.
 */
export const site: 'admin' | 'merchant' | 'any' = sameOrigin(config.adminUrl)
  ? 'admin'
  : sameOrigin(config.merchantUrl)
    ? 'merchant'
    : 'any';

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
