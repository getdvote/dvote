/** Colours and sizes from the customer app designs (iOS-style grouped look). */
export const theme = {
  background: '#F2F2F7',
  surface: '#FFFFFF',
  text: '#000000',
  secondary: '#3C3C43',
  muted: '#8E8E93',
  separator: '#E5E5EA',
  fill: '#E9E9EE', // grey pills (three-dots menu buttons, active tab)
  placeholder: '#B5B5BA',
  primary: '#000000',
  onPrimary: '#FFFFFF',
  link: '#007AFF',
  danger: '#FF3B30',
  dangerSoft: '#FDECEC',
  success: '#34C759',
  brand: '#6155F5', // dvote purple (About)
  radius: 24,
  rowHeight: 52,
  gutter: 16,
} as const;

/**
 * Smooth "squircle" corners for every rounded rectangle and pill: Apple's continuous corner
 * curve, the same as Figma's 60% corner smoothing ("iOS" preset). Spread it next to any
 * borderRadius: `{ borderRadius: theme.radius, ...squircle }`. iOS only (React Native has no
 * Android support, where corners stay regular). Not used on perfect circles (avatars, round
 * icon buttons), which stay round.
 */
export const squircle = { borderCurve: 'continuous' } as const;

/**
 * App font: Inter (Google Fonts, via @expo-google-fonts/inter, loaded in app/_layout).
 * Each weight is a separate font file; components/Text picks the right one from fontWeight.
 */
export const INTER_FONTS = {
  Inter_400Regular: 'Inter_400Regular',
  Inter_500Medium: 'Inter_500Medium',
  Inter_600SemiBold: 'Inter_600SemiBold',
  Inter_700Bold: 'Inter_700Bold',
  Inter_800ExtraBold: 'Inter_800ExtraBold',
} as const;

/**
 * Arabic font: IBM Plex Sans Arabic (Inter has no Arabic letters). It also has Latin letters,
 * so shop names in English still look right inside Arabic screens. No 800 weight: Bold is used.
 */
export const ARABIC_FONTS = {
  IBMPlexSansArabic_400Regular: 'IBMPlexSansArabic_400Regular',
  IBMPlexSansArabic_500Medium: 'IBMPlexSansArabic_500Medium',
  IBMPlexSansArabic_600SemiBold: 'IBMPlexSansArabic_600SemiBold',
  IBMPlexSansArabic_700Bold: 'IBMPlexSansArabic_700Bold',
} as const;

/** The font file for a fontWeight (default and anything up to 400: Regular), in the app language's font. */
export function fontFamily(weight: string | number | undefined, arabic = false): string {
  if (arabic) {
    switch (String(weight ?? '400')) {
      case '500':
        return ARABIC_FONTS.IBMPlexSansArabic_500Medium;
      case '600':
        return ARABIC_FONTS.IBMPlexSansArabic_600SemiBold;
      case '700':
      case '800':
      case '900':
      case 'bold':
        return ARABIC_FONTS.IBMPlexSansArabic_700Bold;
      default:
        return ARABIC_FONTS.IBMPlexSansArabic_400Regular;
    }
  }
  switch (String(weight ?? '400')) {
    case '500':
      return INTER_FONTS.Inter_500Medium;
    case '600':
      return INTER_FONTS.Inter_600SemiBold;
    case '700':
    case 'bold':
      return INTER_FONTS.Inter_700Bold;
    case '800':
    case '900':
      return INTER_FONTS.Inter_800ExtraBold;
    default:
      return INTER_FONTS.Inter_400Regular;
  }
}

/** Space under scrolling tab content so the floating tab bar never covers it. */
export const TAB_BAR_SPACE = 120;

/**
 * The 10 loyalty-card designs a vendor picks from in the dashboards (vendors.card_design 1-10).
 * Keep in step with apps/dashboard/src/lib/cardDesigns.ts (same order, colours and patterns).
 */
export type CardPattern = 'petals' | 'circles' | 'stripes' | 'dots';
export interface CardDesign {
  id: number;
  name: string;
  colors: [string, string];
  /** Text colour on the card. */
  ink: string;
  pattern: CardPattern;
}

export const CARD_DESIGNS: CardDesign[] = [
  { id: 1, name: 'Midnight', colors: ['#1C1C1E', '#3A3A3C'], ink: '#FFFFFF', pattern: 'petals' },
  { id: 2, name: 'Mint', colors: ['#2E9E6B', '#4BC08A'], ink: '#FFFFFF', pattern: 'circles' },
  { id: 3, name: 'Ocean', colors: ['#2F6BDE', '#4F8BF2'], ink: '#FFFFFF', pattern: 'stripes' },
  { id: 4, name: 'Honey', colors: ['#F2B33D', '#F7CF6B'], ink: '#1C1C1E', pattern: 'dots' },
  { id: 5, name: 'Violet', colors: ['#6155F5', '#8A80FF'], ink: '#FFFFFF', pattern: 'petals' },
  { id: 6, name: 'Coral', colors: ['#E0533D', '#F27A60'], ink: '#FFFFFF', pattern: 'circles' },
  { id: 7, name: 'Teal', colors: ['#0E8C99', '#2DB3BF'], ink: '#FFFFFF', pattern: 'stripes' },
  { id: 8, name: 'Espresso', colors: ['#3E2723', '#795548'], ink: '#FFFFFF', pattern: 'dots' },
  { id: 9, name: 'Berry', colors: ['#AD1457', '#EC407A'], ink: '#FFFFFF', pattern: 'circles' },
  { id: 10, name: 'Latte', colors: ['#E9DCC9', '#F7F1E8'], ink: '#3E2723', pattern: 'petals' },
];

/** The vendor's chosen design, or (none chosen) a stable one from its id: same on every phone. */
export function cardDesign(vendorId: string, chosen?: number | null): CardDesign {
  if (chosen && chosen >= 1 && chosen <= CARD_DESIGNS.length) return CARD_DESIGNS[chosen - 1];
  let h = 0;
  for (const ch of vendorId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CARD_DESIGNS[h % CARD_DESIGNS.length];
}

/** The card gradient of a vendor (shop banners, headers and dots use the same colours). */
export function vendorColors(vendorId: string, chosen?: number | null): [string, string] {
  return cardDesign(vendorId, chosen).colors;
}

/** Text colour on a card with these colours. */
export function onCardColor([from]: [string, string]): string {
  return CARD_DESIGNS.find((d) => d.colors[0] === from)?.ink ?? '#FFFFFF';
}
