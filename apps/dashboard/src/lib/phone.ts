/**
 * Egyptian mobile numbers (same rule as the API): typed the local way ("010 0123 4567"),
 * stored as "+201001234567". A +20 / 0020 prefix, spaces and dashes are accepted too.
 */
export function toEgyptianMobile(raw: string): string | null {
  const s = raw.replace(/[\s\-()]/g, '');
  const m = /^(?:\+20|0020|20)?0?(1[0125][0-9]{8})$/.exec(s);
  return m ? `+20${m[1]}` : null;
}

/** "+201001234567" or "01001234567" → "010 0123 4567" (as Egyptians write it); other values unchanged. */
export function formatEgyptianMobile(stored: string | null | undefined): string {
  const m = /^\+20(1[0125])([0-9]{4})([0-9]{4})$/.exec(toEgyptianMobile(stored ?? '') ?? '');
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : (stored ?? '');
}
