/** Public settings from apps/landing/.env (VITE_* values are bundled into the page). */
const clean = (v: string | undefined) => (v ?? '').trim().replace(/\/+$/, '');

export const config = {
  /** "Log in": the merchant dashboard. */
  merchantUrl: clean(import.meta.env.VITE_MERCHANT_URL) || 'https://merchant.dvote.co',
  /** The customer storefront, where the privacy policy and terms live. */
  storefrontUrl: clean(import.meta.env.VITE_STOREFRONT_URL) || 'https://m.dvote.co',
  whatsapp: '201207118966',
  whatsappDisplay: '+20 120 711 8966',
  email: 'getdvote@gmail.com',
};

export const whatsappLink = (message: string) => `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(message)}`;
