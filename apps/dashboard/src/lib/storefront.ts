import type { BrandFont, PageStyle, StorefrontSection } from './api';

/** Keep in step with apps/api/src/storefront/storefront.ts. */
export const SECTION_TYPES: StorefrontSection['type'][] = ['loyalty', 'rewards', 'menu', 'branches', 'wifi'];
export const LOYALTY_LABELS = ['loyalty_card', 'join_club', 'collect_points'] as const;
export const WIFI_SECURITY = ['wpa', 'wep', 'none'] as const;
export const PAGE_STYLES: PageStyle[] = ['spotlight', 'compact', 'branded'];

/** Curated Google Fonts (key → family), as the API knows them. */
export const BRAND_FONTS: Record<BrandFont, string> = {
  inter: 'Inter',
  poppins: 'Poppins',
  montserrat: 'Montserrat',
  dm_sans: 'DM Sans',
  playfair: 'Playfair Display',
  lora: 'Lora',
  cairo: 'Cairo',
  tajawal: 'Tajawal',
  almarai: 'Almarai',
  ibm_plex_arabic: 'IBM Plex Sans Arabic',
};

/** A new section with its default settings. */
export function newSection(type: StorefrontSection['type']): StorefrontSection {
  switch (type) {
    case 'loyalty':
      return { type, label: 'loyalty_card' };
    case 'wifi':
      return { type, ssid: '', security: 'wpa', password: '' };
    default:
      return { type };
  }
}

/** Loads Google Fonts for previews in the dashboard (once per family). */
export function loadFonts(families: string[]) {
  const id = 'storefront-fonts';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${families.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@600`).join('&')}&display=swap`;
  document.head.appendChild(link);
}
