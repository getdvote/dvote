import { userTracker } from './rate-limit';

describe('userTracker', () => {
  const asPhone = (token: string, ip = '1.1.1.1') => userTracker({ ip, headers: { authorization: `Bearer ${token}` } });

  it('counts each paired phone on its own, wherever it connects from', () => {
    const a = `dvs_${'a'.repeat(64)}`;
    const b = `dvs_${'b'.repeat(64)}`;
    expect(asPhone(a)).toMatch(/^scanner:[0-9a-f]{16}$/);
    expect(asPhone(a)).not.toBe(asPhone(b));
    expect(asPhone(a, '1.1.1.1')).toBe(asPhone(a, '2.2.2.2'));
  });

  it('never puts the token in the rate-limit key', () => {
    expect(asPhone(`dvs_${'a'.repeat(64)}`)).not.toContain('aaaa');
  });

  it('still falls back to the IP without a token', () => {
    expect(userTracker({ ip: '1.1.1.1', headers: {} })).toBe('ip:1.1.1.1');
  });
});
