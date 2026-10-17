import { BadRequestException } from '@nestjs/common';

/**
 * The storefront: the sections of a merchant's public page (dvote.app/<slug>), in order. A
 * section not in the list is not shown. Stored as jsonb on vendors (the shop) and branches (a
 * branch's own copy); checked here, never trusted from the client.
 */
export const SECTION_TYPES = ['loyalty', 'rewards', 'menu', 'branches', 'wifi', 'feedback'] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

/** Button / heading words the merchant picks from (translated on the page). */
export const LOYALTY_LABELS = ['loyalty_card', 'join_club', 'collect_points'] as const;
export const WIFI_SECURITY = ['wpa', 'wep', 'none'] as const;

export type StorefrontSection =
  | { type: 'loyalty'; label: (typeof LOYALTY_LABELS)[number] }
  | { type: 'rewards' }
  | { type: 'menu' }
  | { type: 'branches' }
  | { type: 'feedback'; placeholder?: { en: string; ar: string } }
  | { type: 'wifi'; ssid: string; security: (typeof WIFI_SECURITY)[number]; password: string };

export interface Storefront {
  sections: StorefrontSection[];
}

/** What a shop shows before it changes anything. */
export const DEFAULT_STOREFRONT: Storefront = {
  sections: [{ type: 'loyalty', label: 'loyalty_card' }, { type: 'rewards' }, { type: 'menu' }, { type: 'branches' }],
};

export const PAGE_STYLES = ['spotlight', 'compact', 'branded', 'playful', 'split'] as const;
export type PageStyle = (typeof PAGE_STYLES)[number];

/** Curated Google Fonts for the page (key → family); the Arabic ones also cover Latin. */
export const BRAND_FONTS = {
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
} as const;
export type BrandFont = keyof typeof BRAND_FONTS;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const pick = <T extends readonly string[]>(list: T, v: unknown, fallback: T[number]): T[number] =>
  list.includes(v as string) ? (v as T[number]) : fallback;

/**
 * A clean storefront from client input; 400 invalid_storefront on anything structurally wrong.
 * The loyalty section can't be removed (it is put back first); the menu section is always "Menu".
 */
export function checkStorefront(input: unknown): Storefront {
  const bad = (message: string) => new BadRequestException({ code: 'invalid_storefront', message });
  if (!input || typeof input !== 'object' || !Array.isArray((input as Storefront).sections)) throw bad('sections must be a list');
  const seen = new Set<SectionType>();
  const sections = (input as { sections: unknown[] }).sections.map((raw, i): StorefrontSection => {
    const s = (raw ?? {}) as Record<string, unknown>;
    const type = s.type as SectionType;
    if (!SECTION_TYPES.includes(type)) throw bad(`Section ${i + 1}: unknown type`);
    if (seen.has(type)) throw bad(`Section ${i + 1}: ${type} is already on the page`);
    seen.add(type);
    switch (type) {
      case 'loyalty':
        return { type, label: pick(LOYALTY_LABELS, s.label, 'loyalty_card') };
      case 'feedback': {
        if (s.placeholder === undefined) return { type };
        const p = s.placeholder as Record<string, unknown> | null;
        if (!p || typeof p !== 'object' || typeof p.en !== 'string' || typeof p.ar !== 'string' || !p.en.trim() || !p.ar.trim() || p.en.length > 300 || p.ar.length > 300) {
          throw bad('Feedback placeholder needs both English and Arabic (1–300 characters each)');
        }
        return { type, placeholder: { en: p.en.trim(), ar: p.ar.trim() } };
      }
      case 'wifi':
        return {
          type,
          ssid: str(s.ssid, 32),
          security: pick(WIFI_SECURITY, s.security, 'wpa'),
          password: str(s.password, 63),
        };
      default:
        return { type };
    }
  });
  // the loyalty card is the core of the page: always on it (first, when it was missing)
  if (!seen.has('loyalty')) sections.unshift({ type: 'loyalty', label: 'loyalty_card' });
  return { sections };
}

/** A stored value (possibly old or hand-edited) as a storefront; falls back to the default. */
export function readStorefront(stored: unknown): Storefront {
  if (!stored) return DEFAULT_STOREFRONT;
  try {
    return checkStorefront(stored);
  } catch {
    return DEFAULT_STOREFRONT;
  }
}
