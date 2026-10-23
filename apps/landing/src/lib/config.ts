/** Public settings from apps/landing/.env (VITE_* values are bundled into the page). */
const clean = (v: string | undefined) => (v ?? '').trim().replace(/\/+$/, '');

export const config = {
  /** "Log in" and "Start free trial": the merchant dashboard. */
  merchantUrl: clean(import.meta.env.VITE_MERCHANT_URL) || 'https://merchant.dvote.co',
  /** The customer storefront, where the privacy policy and terms live. */
  storefrontUrl: clean(import.meta.env.VITE_STOREFRONT_URL) || 'https://m.dvote.co',
  /** The dvote API: public plans and the Founding Merchants counter. */
  apiUrl: clean(import.meta.env.VITE_API_URL) || 'https://api.dvote.co',
  whatsapp: '201207118966',
  whatsappDisplay: '+20 120 711 8966',
  email: 'getdvote@gmail.com',
};

export const whatsappLink = (message: string) => `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(message)}`;

/** Sign-up link; the dashboard keeps `plan` and `cycle` in the sign-up details. */
export const signupUrl = (plan?: string, cycle?: 'monthly' | 'annual') => {
  const q = new URLSearchParams();
  if (plan) q.set('plan', plan);
  if (cycle) q.set('cycle', cycle);
  const s = q.toString();
  return `${config.merchantUrl}/signup${s ? `?${s}` : ''}`;
};
