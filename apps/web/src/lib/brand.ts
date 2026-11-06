import { useEffect } from 'react';
import type { PublicVendor } from './api';
import { cardDesign } from './cardDesigns';

/** Readable text on a #rrggbb background: dark ink on light colours, white otherwise. */
function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 170 ? '#18100F' : '#FFFFFF';
}

/**
 * The colours of the merchant's loyalty card: its live look (Dashboard → Cards → Design card),
 * else the old automatic design (merchants without a card yet).
 */
export function cardLook(vendor: Pick<PublicVendor, 'id' | 'cardDesign' | 'card'>) {
  if (vendor.card) return { color: vendor.card.colors.background, color2: vendor.card.colors.background, ink: vendor.card.colors.text };
  const design = cardDesign(vendor.id, vendor.cardDesign);
  return { color: design.colors[0], color2: design.colors[1], ink: design.ink };
}

/** The merchant's page colours: brand colours from Settings → Branding, else the card colours. */
export function brandColors(vendor: PublicVendor) {
  const look = cardLook(vendor);
  const primary = vendor.style.primary ?? look.color;
  const secondary = vendor.style.secondary ?? look.color2;
  const ink = vendor.style.primary ? inkOn(primary) : look.ink;
  // icons and coloured text on white: the brand colour, or dark ink when the colour is too light to read
  const accent = inkOn(primary) === '#FFFFFF' ? primary : '#18100F';
  return { primary, secondary, ink, accent };
}

/** Loads the merchant's display font from Google Fonts (once) while the page shows. */
export function useBrandFont(family: string | null) {
  useEffect(() => {
    if (!family) return;
    const id = `font-${family.replace(/\s+/g, '-').toLowerCase()}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;600;700&display=swap`;
    document.head.appendChild(link);
  }, [family]);
}

/** CSS font-family for headings: the merchant's font, then the page font. */
export const displayFont = (family: string | null) => (family ? `"${family}", var(--font-sans)` : undefined);
