import { BadRequestException } from '@nestjs/common';
import { assertWeek, type HoursSlot } from '../branches/hours';

/**
 * The look of a merchant's loyalty card: one JSON document per saved version
 * (loyalty_card_versions.design). Checked here, never trusted from the client.
 * Keep the shape in step with apps/dashboard/src/lib/card-look.ts and apps/web/src/lib/api.ts.
 */
export const BACKGROUND_STYLES = ['solid', 'gradient', 'mesh', 'waves', 'dots'] as const;
export type BackgroundStyle = (typeof BACKGROUND_STYLES)[number];

export const LINK_PLATFORMS = [
  'instagram', 'facebook', 'tiktok', 'x', 'snapchat', 'whatsapp', 'youtube', 'linkedin', 'website', 'custom',
] as const;
export type LinkPlatform = (typeof LINK_PLATFORMS)[number];

export const MAX_LINKS = 5;

export interface Bilingual {
  en: string;
  ar: string;
}

export type SecondaryButton =
  | { type: 'none' }
  | { type: 'directions'; branchId: string }
  | { type: 'call'; phone: string };

export interface CardLink {
  platform: LinkPlatform;
  /** A handle (@yourcafe), a phone (WhatsApp) or a URL. */
  value: string;
  /** Only for custom links. */
  label?: string;
}

export interface CardDesign {
  colors: {
    background: string;
    text: string;
    label: string;
    /** The background follows the merchant's brand colour. */
    useBrand: boolean;
    /** Text / labels are picked by contrast with the background. */
    autoText: boolean;
    autoLabel: boolean;
  };
  background: { style: BackgroundStyle; imageUrl: string | null; imagePath: string | null };
  front: { title: Bilingual; pointsLabel: Bilingual };
  buttons: { primaryLabel: Bilingual; secondary: SecondaryButton };
  back: { about: string; hours: HoursSlot[]; links: CardLink[]; terms: string };
}

export const DEFAULT_POINTS_LABEL: Bilingual = { en: 'Points', ar: 'النقاط' };
export const DEFAULT_PRIMARY_LABEL: Bilingual = { en: 'Offers & Rewards', ar: 'العروض والمكافآت' };

/** Black or white, whichever reads better on the background. */
export function readableInk(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? '#1C1C1E' : '#FFFFFF';
}

/** A first card: the merchant's colour, solid background, the default wording. */
/** dvote espresso: the card colour when a merchant has no brand colour or chosen design yet. */
export const DVOTE_CARD_COLOR = '#18100F';

export function defaultDesign(name: string, background: string): CardDesign {
  const ink = readableInk(background);
  return {
    colors: { background, text: ink, label: ink, useBrand: false, autoText: true, autoLabel: true },
    background: { style: 'solid', imageUrl: null, imagePath: null },
    front: { title: { en: name.slice(0, 40), ar: '' }, pointsLabel: { ...DEFAULT_POINTS_LABEL } },
    buttons: { primaryLabel: { ...DEFAULT_PRIMARY_LABEL }, secondary: { type: 'none' } },
    back: { about: '', hours: [], links: [], terms: '' },
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

/**
 * A clean design from client input (unknown keys dropped, text trimmed and cut to length);
 * 400 invalid_design when something can't be fixed by trimming (bad colour, unknown style,
 * too many links, bad hours). Image fields are only kept as given by our own upload endpoint.
 */
export function checkDesign(input: unknown): CardDesign {
  const bad = (message: string) => new BadRequestException({ code: 'invalid_design', message });
  const d = obj(input);

  const c = obj(d.colors);
  const color = (v: unknown, field: string) => {
    if (typeof v !== 'string' || !HEX.test(v)) throw bad(`colors.${field} must be #rrggbb`);
    return v.toUpperCase();
  };
  const background = color(c.background, 'background');

  const bg = obj(d.background);
  const style = bg.style ?? 'solid';
  if (!BACKGROUND_STYLES.includes(style as BackgroundStyle)) throw bad('unknown background style');
  const imagePath = str(bg.imagePath, 300) || null;
  const imageUrl = imagePath ? str(bg.imageUrl, 500) || null : null;

  const bilingual = (v: unknown, max: number, fallback: Bilingual): Bilingual => {
    const o = obj(v);
    const en = str(o.en, max);
    return { en: en || fallback.en, ar: str(o.ar, max) };
  };
  const front = obj(d.front);
  const buttons = obj(d.buttons);

  const s = obj(buttons.secondary);
  let secondary: SecondaryButton;
  if (s.type === undefined || s.type === 'none') secondary = { type: 'none' };
  else if (s.type === 'directions') {
    if (typeof s.branchId !== 'string' || !UUID.test(s.branchId)) throw bad('directions needs a branch');
    secondary = { type: 'directions', branchId: s.branchId };
  } else if (s.type === 'call') {
    const phone = str(s.phone, 30).replace(/[\s\-()]/g, '');
    if (!/^\+?\d{6,15}$/.test(phone)) throw bad('call needs a phone number');
    secondary = { type: 'call', phone };
  } else throw bad('unknown button type');

  const back = obj(d.back);
  const rawHours = Array.isArray(back.hours) ? back.hours : [];
  // the card shows one opening time per day (no split shifts)
  if (rawHours.length > 7) throw new BadRequestException({ code: 'too_many_slots' });
  const hours = assertWeek(
    rawHours.map((h) => {
      const o = obj(h);
      const day = o.day;
      if (typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day > 6) throw bad('hours.day must be 0-6');
      if (typeof o.opensAt !== 'string' || !CLOCK.test(o.opensAt) || typeof o.closesAt !== 'string' || !CLOCK.test(o.closesAt))
        throw bad('hours must be HH:MM');
      return { day, opensAt: o.opensAt, closesAt: o.closesAt };
    }),
  );
  if (new Set(hours.map((h) => h.day)).size !== hours.length) throw new BadRequestException({ code: 'too_many_slots' });

  const rawLinks = Array.isArray(back.links) ? back.links : [];
  if (rawLinks.length > MAX_LINKS) throw bad(`at most ${MAX_LINKS} links`);
  const links = rawLinks.map((l): CardLink => {
    const o = obj(l);
    if (!LINK_PLATFORMS.includes(o.platform as LinkPlatform)) throw bad('unknown link platform');
    const value = str(o.value, 300);
    if (!value) throw bad('a link needs a value');
    const platform = o.platform as LinkPlatform;
    if (platform === 'custom') {
      const label = str(o.label, 40);
      if (!label) throw bad('a custom link needs a label');
      if (!/^https?:\/\/\S+$/i.test(value)) throw bad('a custom link must start with http:// or https://');
      return { platform, value, label };
    }
    return { platform, value };
  });

  return {
    colors: {
      background,
      text: color(c.text, 'text'),
      label: color(c.label, 'label'),
      useBrand: bool(c.useBrand, false),
      autoText: bool(c.autoText, true),
      autoLabel: bool(c.autoLabel, true),
    },
    background: { style: style as BackgroundStyle, imageUrl, imagePath },
    front: {
      title: bilingual(front.title, 40, { en: 'Loyalty card', ar: '' }),
      pointsLabel: bilingual(front.pointsLabel, 20, DEFAULT_POINTS_LABEL),
    },
    buttons: { primaryLabel: bilingual(buttons.primaryLabel, 30, DEFAULT_PRIMARY_LABEL), secondary },
    back: { about: str(back.about, 1000), hours, links, terms: str(back.terms, 2000) },
  };
}

/** A stored design (older or hand-edited rows): never throws, falls back to the defaults. */
export function readDesign(json: unknown, name: string): CardDesign {
  try {
    return checkDesign(json);
  } catch {
    const fallback = obj(obj(json).colors).background;
    return defaultDesign(name, typeof fallback === 'string' && HEX.test(fallback) ? fallback : DVOTE_CARD_COLOR);
  }
}

const SOCIAL_BASE: Partial<Record<LinkPlatform, string>> = {
  instagram: 'https://instagram.com/',
  facebook: 'https://facebook.com/',
  tiktok: 'https://www.tiktok.com/@',
  x: 'https://x.com/',
  snapchat: 'https://snapchat.com/add/',
  youtube: 'https://youtube.com/@',
  linkedin: 'https://www.linkedin.com/company/',
};

/** Where a back-of-card link opens: a typed URL as is, a handle on its platform, WhatsApp by number. */
export function linkHref(link: CardLink): string {
  const v = link.value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (link.platform === 'whatsapp') return `https://wa.me/${v.replace(/\D/g, '')}`;
  if (link.platform === 'website') return `https://${v}`;
  const base = SOCIAL_BASE[link.platform];
  return base ? base + v.replace(/^@/, '') : v;
}

/** Display names for the links on the pass (Google shows the description). */
export const LINK_NAMES: Record<Exclude<LinkPlatform, 'custom'>, Bilingual> = {
  instagram: { en: 'Instagram', ar: 'إنستغرام' },
  facebook: { en: 'Facebook', ar: 'فيسبوك' },
  tiktok: { en: 'TikTok', ar: 'تيك توك' },
  x: { en: 'X', ar: 'إكس' },
  snapchat: { en: 'Snapchat', ar: 'سناب شات' },
  whatsapp: { en: 'WhatsApp', ar: 'واتساب' },
  youtube: { en: 'YouTube', ar: 'يوتيوب' },
  linkedin: { en: 'LinkedIn', ar: 'لينكدإن' },
  website: { en: 'Website', ar: 'الموقع' },
};
