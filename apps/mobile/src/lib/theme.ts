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

/** The Inter font file for a fontWeight (default and anything up to 400: Regular). */
export function fontFamily(weight: string | number | undefined): string {
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
 * Card colours. Vendors have no brand colour in the API yet, so each vendor gets a stable
 * pair from this palette (same vendor → same colour on every phone).
 */
const PALETTE: [string, string][] = [
  ['#1C1C1E', '#3A3A3C'],
  ['#2E9E6B', '#4BC08A'],
  ['#2F6BDE', '#4F8BF2'],
  ['#F2B33D', '#F7CF6B'],
  ['#6155F5', '#8A80FF'],
  ['#E0533D', '#F27A60'],
  ['#0E8C99', '#2DB3BF'],
];

export function vendorColors(vendorId: string): [string, string] {
  let h = 0;
  for (const ch of vendorId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Dark text on the light (yellow) card, white elsewhere. */
export function onCardColor([from]: [string, string]): string {
  return from === '#F2B33D' ? '#1C1C1E' : '#FFFFFF';
}
