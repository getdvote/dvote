import { useEffect } from 'react';
import type { PublicVendor } from './api';
import { cardDesign } from './cardDesigns';

/** Readable text on a #rrggbb background: dark ink on light colours, white otherwise. */
function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 170 ? '#1C1C1E' : '#FFFFFF';
}

/** The merchant's page colours: brand colours from Settings → Branding, else the card colours. */
export function brandColors(vendor: PublicVendor) {
  const design = cardDesign(vendor.id, vendor.cardDesign);
  const primary = vendor.style.primary ?? design.colors[0];
  const secondary = vendor.style.secondary ?? design.colors[1];
  const ink = vendor.style.primary ? inkOn(primary) : design.ink;
  // icons and coloured text on white: the brand colour, or dark ink when the colour is too light to read
  const accent = inkOn(primary) === '#FFFFFF' ? primary : '#1C1C1E';
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
