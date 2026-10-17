/**
 * Egyptian mobile numbers only (decided 2026-10-17): 010, 011, 012 or 015 + 8 digits.
 * Accepts what people type (spaces, dashes, 01…, 201…, +201…, 00201…) and returns the one
 * stored form `+201XXXXXXXXX`, or null when it isn't an Egyptian mobile.
 */
export function egyptianMobile(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, '');
  const m = /^(?:\+20|0020|20)?0?(1[0125]\d{8})$/.exec(digits);
  return m ? `+20${m[1]}` : null;
}
