import type { VendorCategory } from './api';

/**
 * The 10 loyalty-card designs a vendor picks from (vendors.card_design 1-10). The customer app
 * draws the same ones: keep in step with apps/mobile/src/lib/theme.ts (CARD_DESIGNS).
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

/** The chosen design, or (none chosen) the one the app picks automatically from the vendor id. */
export function cardDesign(vendorId: string, chosen?: number | null): CardDesign {
  if (chosen && chosen >= 1 && chosen <= CARD_DESIGNS.length) return CARD_DESIGNS[chosen - 1];
  let h = 0;
  for (const ch of vendorId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CARD_DESIGNS[h % CARD_DESIGNS.length];
}

/** Business categories (same list as the API and the database CHECK). */
export const VENDOR_CATEGORIES: { value: VendorCategory; label: string }[] = [
  { value: 'cafe', label: 'Café' },
  { value: 'cafe_restaurant', label: 'Café & restaurant' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'desserts', label: 'Desserts' },
  { value: 'juice_bar', label: 'Juice bar' },
];

export const categoryLabel = (c: VendorCategory | null) => VENDOR_CATEGORIES.find((x) => x.value === c)?.label ?? null;
