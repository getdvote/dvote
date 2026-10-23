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
