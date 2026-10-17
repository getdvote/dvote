import { egyptianMobile } from './egyptian-phone';

describe('egyptianMobile', () => {
  it.each([
    ['01001234567', '+201001234567'],
    ['0111 234 5678', '+201112345678'],
    ['012-1234-5678', '+201212345678'],
    ['01512345678', '+201512345678'],
    ['+201001234567', '+201001234567'],
    ['201001234567', '+201001234567'],
    ['00201001234567', '+201001234567'],
    ['1001234567', '+201001234567'],
  ])('%s → %s', (input, expected) => {
    expect(egyptianMobile(input)).toBe(expected);
  });

  it.each([
    '01301234567', // 013 is not a mobile prefix
    '0100123456', // too short
    '010012345678', // too long
    '0221234567', // a Cairo landline
    '+971501234567', // UAE
    'not a number',
    '',
  ])('rejects %s', (input) => {
    expect(egyptianMobile(input)).toBeNull();
  });
});
