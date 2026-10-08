import { newQrCode, QR_PREFIX, tokenHashOf } from './qr-code.token';

describe('QR code tokens', () => {
  it('issues a prefixed random code whose hash can be recomputed from the scan', () => {
    const { code, tokenHash } = newQrCode();
    expect(code.startsWith(QR_PREFIX)).toBe(true);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHashOf(code)).toBe(tokenHash);
    expect(tokenHashOf(`  ${code}\n`)).toBe(tokenHash); // scanners may add whitespace
  });

  it('never repeats', () => {
    const codes = new Set(Array.from({ length: 1000 }, () => newQrCode().code));
    expect(codes.size).toBe(1000);
  });

  it.each([
    'hello',
    'dvote:q1:',
    'dvote:q1:short',
    'dvote:q2:AAAAAAAAAAAAAAAAAAAAAA',
    'https://example.com',
  ])('rejects %j', (text) => {
    expect(tokenHashOf(text)).toBeNull();
  });
});
