import type { StaffMe } from './api';

type Rule = NonNullable<StaffMe['activeRule']>;

/** "10 EGP = 1 point" (".00" dropped), plus the minimum purchase if any. */
export function describeRule(rule: Rule, currency: string): string {
  const money = (v: string) => v.replace(/\.00$/, '');
  const points = rule.pointsPerSpend === 1 ? '1 point' : `${rule.pointsPerSpend} points`;
  let text = `${money(rule.spendAmount)} ${currency} = ${points}`;
  if (Number(rule.minPurchase) > 0) text += ` · min ${money(rule.minPurchase)} ${currency}`;
  if (rule.maxPointsPerPurchase !== null) text += ` · max ${rule.maxPointsPerPurchase} per receipt`;
  return text;
}

/**
 * Parses what staff type: "380", "95.5", "95,50". Returns minor units (piastres) or
 * null if not a positive amount with at most 2 decimals.
 */
export function parseAmount(text: string): number | null {
  const match = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  const minor = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return minor > 0 ? minor : null;
}

/**
 * Preview only, same formula as the server (which decides the real number):
 * floor(amount / spend) × points_per_spend, capped; 0 below the minimum.
 */
export function estimatePoints(amountMinor: number, rule: Rule): number {
  const toMinor = (v: string) => Math.round(Number(v) * 100);
  if (amountMinor < toMinor(rule.minPurchase)) return 0;
  const points = Math.floor(amountMinor / toMinor(rule.spendAmount)) * rule.pointsPerSpend;
  return rule.maxPointsPerPurchase === null ? points : Math.min(points, rule.maxPointsPerPurchase);
}
