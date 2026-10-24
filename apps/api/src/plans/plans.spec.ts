import { monthlyPrice, PLAN_PRICES } from './plans';

describe('plan prices', () => {
  it('adds each extra branch to the plan price', () => {
    expect(monthlyPrice('regular', 1)).toBe(499);
    expect(monthlyPrice('loyal', 3)).toBe(1797);
    expect(monthlyPrice('chain', 10)).toBe(6490);
    expect(monthlyPrice('regular', 5)).toBe(1695);
  });
  it('uses the annual per-month prices', () => {
    expect(monthlyPrice('regular', 1, 'annual')).toBe(416);
    expect(monthlyPrice('loyal', 2, 'annual')).toBe(833 + 333);
  });
  it('annual total is ten months', () => {
    for (const p of PLAN_PRICES) expect(p.annualTotal).toBe(p.monthly * 10);
  });
});

import { addPeriod, quote } from './plans';

describe('billing helpers', () => {
  it('quotes plan + extra branches, Founding only on the base', () => {
    expect(quote('loyal', 'monthly', 3)).toMatchObject({ base: 999, extraBranches: 798, monthly: 1797, perPeriod: 1797 });
    expect(quote('loyal', 'monthly', 3, true)).toMatchObject({ base: 699, monthly: 699 + 798 });
    expect(quote('regular', 'annual', 1)).toMatchObject({ monthly: 416, perPeriod: 4990 });
    expect(quote('loyal', 'annual', 2)).toMatchObject({ monthly: 833 + 333, perPeriod: 9990 + 333 * 12 });
    expect(quote('regular', 'annual', 1, true).base).toBe(291);
  });
  it('adds a month or a year', () => {
    expect(addPeriod(new Date('2026-01-31T10:00:00Z'), 'monthly').toISOString()).toBe('2026-02-28T10:00:00.000Z');
    expect(addPeriod(new Date('2026-10-23T10:00:00Z'), 'monthly').toISOString()).toBe('2026-11-23T10:00:00.000Z');
    expect(addPeriod(new Date('2026-10-23T10:00:00Z'), 'annual').toISOString()).toBe('2027-10-23T10:00:00.000Z');
  });
});
