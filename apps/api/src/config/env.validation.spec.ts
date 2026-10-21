import 'reflect-metadata';
import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const base = {
    DATABASE_URL: 'postgresql://x',
    SUPABASE_URL: 'https://abc.supabase.co',
  };

  it('applies defaults', () => {
    expect(validateEnv(base)).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      ADMIN_MFA_REQUIRED: true,
    });
  });

  it('parses PORT from a string', () => {
    expect(validateEnv({ ...base, PORT: '3099' }).PORT).toBe(3099);
  });

  it.each([
    ['false', false],
    [' FALSE ', false],
    ['true', true],
    ['0', true], // only the word "false" turns two-factor off
  ])('ADMIN_MFA_REQUIRED=%j → %s', (raw, expected) => {
    expect(
      validateEnv({ ...base, ADMIN_MFA_REQUIRED: raw }).ADMIN_MFA_REQUIRED,
    ).toBe(expected);
  });

  it('rejects a missing DATABASE_URL and a bad SUPABASE_URL', () => {
    expect(() => validateEnv({ SUPABASE_URL: base.SUPABASE_URL })).toThrow(
      /DATABASE_URL/,
    );
    expect(() => validateEnv({ ...base, SUPABASE_URL: 'not a url' })).toThrow(
      /SUPABASE_URL/,
    );
  });
});
