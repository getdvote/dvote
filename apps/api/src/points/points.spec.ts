import { fromMinor, pointsFor, toMinor, type EarnRule } from './points';

const joyCorner: EarnRule = {
  spendAmountMinor: 1000, // 10 EGP
  pointsPerSpend: 1,
  minPurchaseMinor: 0,
  maxPointsPerPurchase: null,
};

describe('toMinor / fromMinor', () => {
  it.each([
    [95, 9500],
    ['95.5', 9550],
    [19.99, 1999],
    ['0.01', 1],
    [{ toFixed: () => '10.00' }, 1000],
  ])('%j → %d', (input, minor) => {
    expect(toMinor(input)).toBe(minor);
  });

  it.each(['-5', '1.234', 'abc', ''])('rejects %j', (input) => {
    expect(() => toMinor(input)).toThrow();
  });

  it('formats back exactly', () => {
    expect(fromMinor(9550)).toBe('95.50');
    expect(fromMinor(1)).toBe('0.01');
  });
});

describe('pointsFor', () => {
  it('rounds down: 95 EGP at 10 EGP/point = 9 points', () => {
    expect(pointsFor(toMinor(95), joyCorner)).toBe(9);
    expect(pointsFor(toMinor('99.99'), joyCorner)).toBe(9);
    expect(pointsFor(toMinor(100), joyCorner)).toBe(10);
  });

  it('below one step earns 0', () => {
    expect(pointsFor(toMinor(8), joyCorner)).toBe(0);
  });

  it('applies points per step, minimum purchase and cap', () => {
    const rule: EarnRule = {
      spendAmountMinor: 1000,
      pointsPerSpend: 2,
      minPurchaseMinor: 5000,
      maxPointsPerPurchase: 30,
    };
    expect(pointsFor(toMinor(49), rule)).toBe(0); // below minimum
    expect(pointsFor(toMinor(55), rule)).toBe(10); // 5 steps × 2
    expect(pointsFor(toMinor(500), rule)).toBe(30); // capped
  });
});
