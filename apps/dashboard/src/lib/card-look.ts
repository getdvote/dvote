import type { CSSProperties } from 'react';
import type { Bilingual, CardBackgroundStyle, CardDesign, CardLink, CardLinkPlatform } from './api';

/**
 * The loyalty card look: defaults, the 5 background designs and the back-of-card links.
 * Mirrors apps/api/src/loyalty-cards/card-design.ts (defaults, limits, link addresses).
 */
export const BACKGROUND_STYLES: CardBackgroundStyle[] = ['solid', 'gradient', 'mesh', 'waves', 'dots'];
export const LINK_PLATFORMS: CardLinkPlatform[] = [
  'instagram',
  'facebook',
  'tiktok',
  'x',
  'snapchat',
  'whatsapp',
  'youtube',
  'linkedin',
  'website',
  'custom',
];
export const MAX_LINKS = 5;
/** The preview slider goes up to this many points. */
export const MAX_PREVIEW_POINTS = 1_000;

export const DEFAULT_POINTS_LABEL: Bilingual = { en: 'Points', ar: 'النقاط' };
export const DEFAULT_PRIMARY_LABEL: Bilingual = {
  en: 'Offers & Rewards',
  ar: 'العروض والمكافآت',
};

/** Black or white, whichever reads better on the background (same rule as the API). */
export function readableInk(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#1C1C1E' : '#FFFFFF';
}

/** Small labels: the text colour, softened. */
export const softLabel = (ink: string) => (ink === '#FFFFFF' ? '#D4D4D8' : '#52525B');

export const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

export function defaultDesign(name: string, background: string): CardDesign {
  const ink = readableInk(background);
  return {
    colors: {
      background,
      text: ink,
      label: softLabel(ink),
      useBrand: true,
      autoText: true,
      autoLabel: true,
    },
    background: { style: 'gradient', imageUrl: null, imagePath: null },
    front: {
      title: { en: name.slice(0, 40), ar: '' },
      pointsLabel: { ...DEFAULT_POINTS_LABEL },
    },
    buttons: {
      primaryLabel: { ...DEFAULT_PRIMARY_LABEL },
      secondary: { type: 'none' },
    },
    back: { about: '', hours: [], links: [], terms: '' },
  };
}

/** The text in a language; Arabic falls back to English when left empty. */
export const pick = (text: Bilingual, lang: 'en' | 'ar') => (lang === 'ar' && text.ar.trim() ? text.ar : text.en);

const mix = (c: string, other: string, pct: number) => `color-mix(in oklab, ${c} ${pct}%, ${other})`;

const wavesSvg = (stroke: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='380' viewBox='0 0 600 380' fill='none'>` +
      [0, 1, 2, 3, 4, 5]
        .map(
          (i) =>
            `<path d='M-20 ${230 + i * 26} C 120 ${170 + i * 26}, 260 ${300 + i * 26}, 400 ${220 + i * 26} S 560 ${150 + i * 26}, 640 ${210 + i * 26}' stroke='${stroke}' stroke-opacity='${0.22 - i * 0.03}' stroke-width='${2.2 - i * 0.2}'/>`,
        )
        .join('') +
      `</svg>`,
  )}")`;

/**
 * The card face background: one of the 5 designs tinted with the background colour, or the
 * uploaded image (darkened a touch at the bottom so the text stays readable).
 */
export function cardBackground(design: CardDesign): CSSProperties {
  const c = design.colors.background;
  const light = readableInk(c) !== '#FFFFFF';
  const glow = light ? '#FFFFFF' : mix(c, '#FFFFFF', 55);
  const shade = light ? mix(c, '#000000', 82) : mix(c, '#000000', 62);
  if (design.background.imageUrl) {
    return {
      backgroundColor: c,
      backgroundImage: `linear-gradient(180deg, transparent 35%, ${mix(c, 'transparent', 70)} 100%), url("${design.background.imageUrl}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  switch (design.background.style) {
    case 'gradient':
      return {
        backgroundColor: c,
        backgroundImage: `linear-gradient(140deg, ${mix(c, '#FFFFFF', 78)} 0%, ${c} 48%, ${shade} 100%)`,
      };
    case 'mesh':
      return {
        backgroundColor: c,
        backgroundImage: [
          `radial-gradient(circle at 12% 8%, ${mix(glow, 'transparent', 70)} 0, transparent 42%)`,
          `radial-gradient(circle at 92% 22%, ${mix(c, '#FF6AD5', 55)} 0, transparent 46%)`,
          `radial-gradient(circle at 70% 105%, ${mix(c, '#3DD6F5', 50)} 0, transparent 52%)`,
          `radial-gradient(circle at 8% 95%, ${shade} 0, transparent 55%)`,
        ].join(', '),
      };
    case 'waves':
      return {
        backgroundColor: c,
        backgroundImage: `${wavesSvg(light ? '#000000' : '#FFFFFF')}, linear-gradient(180deg, ${mix(c, '#FFFFFF', 88)} 0%, ${c} 55%, ${shade} 100%)`,
        backgroundSize: 'cover, cover',
        backgroundPosition: 'center bottom, center',
      };
    case 'dots':
      return {
        backgroundColor: c,
        backgroundImage: `radial-gradient(${light ? 'rgba(0,0,0,.13)' : 'rgba(255,255,255,.2)'} 1.1px, transparent 1.5px), radial-gradient(circle at 85% 0%, ${mix(glow, 'transparent', 45)} 0, transparent 50%), linear-gradient(160deg, ${c} 0%, ${shade} 100%)`,
        backgroundSize: '12px 12px, cover, cover',
      };
    default:
      return { backgroundColor: c };
  }
}

const SOCIAL_BASE: Partial<Record<CardLinkPlatform, string>> = {
  instagram: 'https://instagram.com/',
  facebook: 'https://facebook.com/',
  tiktok: 'https://www.tiktok.com/@',
  x: 'https://x.com/',
  snapchat: 'https://snapchat.com/add/',
  youtube: 'https://youtube.com/@',
  linkedin: 'https://www.linkedin.com/company/',
};

/** Where a back-of-card link opens (same rules as the pass). */
export function linkHref(link: CardLink): string {
  const v = link.value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (link.platform === 'whatsapp') return `https://wa.me/${v.replace(/\D/g, '')}`;
  if (link.platform === 'website') return `https://${v}`;
  const base = SOCIAL_BASE[link.platform];
  return base ? base + v.replace(/^@/, '') : v;
}

/** Same check as the API: what can't be saved yet, as an i18n key (null = fine). */
export type DesignProblem = `cards.problems.${'color' | 'branch' | 'phone' | 'linkValue' | 'customLink' | 'hours'}`;

export function designProblem(d: CardDesign): DesignProblem | null {
  if (![d.colors.background, d.colors.text, d.colors.label].every(isHex)) return 'cards.problems.color';
  const s = d.buttons.secondary;
  if (s.type === 'directions' && !s.branchId) return 'cards.problems.branch';
  if (s.type === 'call' && !/^\+?\d{6,15}$/.test(s.phone.replace(/[\s\-()]/g, ''))) return 'cards.problems.phone';
  if (d.back.hours.some((h) => h.opensAt === h.closesAt)) return 'cards.problems.hours';
  for (const l of d.back.links) {
    if (!l.value.trim()) return 'cards.problems.linkValue';
    if (l.platform === 'custom' && (!l.label?.trim() || !/^https?:\/\/\S+$/i.test(l.value.trim()))) return 'cards.problems.customLink';
  }
  return null;
}

/** Keeps a left-to-right run (an amount like "10 EGP") in order inside Arabic text. */
export const ltr = (text: string) => `\u2066${text}\u2069`;
