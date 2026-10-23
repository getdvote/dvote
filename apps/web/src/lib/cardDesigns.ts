/** The 10 loyalty-card designs: keep identical to apps/dashboard/src/lib/cardDesigns.ts (CARD_DESIGNS). */
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

/** The automatic design (no design chosen): dvote espresso with a plum glow, froth text. */
export const DVOTE_DESIGN: CardDesign = { id: 0, name: 'dvote', colors: ['#18100F', '#5F2B4B'], ink: '#FFFFFF', pattern: 'petals' };

/** The chosen design, or (none chosen) the dvote design. `vendorId` is kept for callers. */
export function cardDesign(_vendorId: string, chosen?: number | null): CardDesign {
  if (chosen && chosen >= 1 && chosen <= CARD_DESIGNS.length) return CARD_DESIGNS[chosen - 1];
  return DVOTE_DESIGN;
}

