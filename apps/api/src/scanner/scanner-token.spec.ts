import {
  hashCode,
  newPairCode,
  newPairSecret,
  newSessionToken,
  sameHash,
  sha256,
} from './scanner-token';

describe('scanner tokens', () => {
  it('makes a 6-digit code, keeping leading zeros', () => {
    for (let i = 0; i < 500; i++) expect(newPairCode()).toMatch(/^\d{6}$/);
  });

  it('makes secrets of the required strength', () => {
    expect(newPairSecret()).toMatch(/^[0-9a-f]{32}$/);
    expect(newSessionToken()).toMatch(/^dvs_[0-9a-f]{64}$/);
  });

  it('never repeats a secret or session token', () => {
    expect(newPairSecret()).not.toBe(newPairSecret());
    expect(newSessionToken()).not.toBe(newSessionToken());
  });

  it('ties the code hash to the secret', () => {
    expect(hashCode('a', '123456')).not.toBe(hashCode('b', '123456'));
    expect(sameHash(hashCode('a', '123456'), hashCode('a', '123456'))).toBe(true);
    expect(sameHash(hashCode('a', '123456'), hashCode('a', '123457'))).toBe(false);
  });

  it('hashes without keeping the value', () => {
    expect(sha256('dvs_x')).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256('dvs_x')).not.toContain('dvs_x');
  });
});
