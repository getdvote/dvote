export type Platform = 'ios' | 'android' | 'other';

/** iPhone / iPad (also iPadOS that reports itself as a Mac) → Apple Wallet; Android → Google Wallet. */
export function platform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}
