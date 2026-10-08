/**
 * Money and points arithmetic. Money is handled in integer minor units (piastres, cents),
 * never as floating point; points always round DOWN.
 */

/** Anything that prints as a decimal number: number, string, or Prisma.Decimal. */
type DecimalLike = number | string | { toFixed(dp: number): string };

/**
 * Converts an amount with at most 2 decimals to minor units: 95.5 → 9550.
 * Parses the decimal text, so 19.99 is exactly 1999 (no 1998.9999 float errors).
 */
export function toMinor(amount: DecimalLike): number {
  const text =
    typeof amount === 'object' ? amount.toFixed(2) : String(amount).trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match)
    throw new Error(`Not a positive amount with ≤ 2 decimals: ${text}`);
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

/** 9550 → "95.50" (for JSON responses: exact, no float). */
export function fromMinor(minor: number): string {
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
}

export interface EarnRule {
  spendAmountMinor: number; // e.g. 1000 = 10.00 EGP
  pointsPerSpend: number; // e.g. 1
  minPurchaseMinor: number; // 0 = no minimum
  maxPointsPerPurchase: number | null; // null = no cap
}

/**
 * points = floor(amount / spend_amount) × points_per_spend, capped at
 * max_points_per_purchase; 0 when the amount is below min_purchase.
 */
export function pointsFor(amountMinor: number, rule: EarnRule): number {
  if (amountMinor < rule.minPurchaseMinor) return 0;
  const points =
    Math.floor(amountMinor / rule.spendAmountMinor) * rule.pointsPerSpend;
  return rule.maxPointsPerPurchase === null
    ? points
    : Math.min(points, rule.maxPointsPerPurchase);
}
