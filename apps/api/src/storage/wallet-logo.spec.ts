import sharp from 'sharp';
import { toWalletLogo } from './wallet-logo';

describe('Wallet logo preparation', () => {
  it.each([[120, 240], [240, 120]])('extends %i x %i artwork with its edge colour', async (width, height) => {
    const original = await sharp({ create: { width, height, channels: 3, background: { r: 24, g: 64, b: 40 } } })
      .composite([{ input: await sharp({ create: { width: 20, height: 20, channels: 3, background: 'white' } }).png().toBuffer(), gravity: 'centre' }])
      .png().toBuffer();
    const output = await toWalletLogo(original);
    expect(await sharp(output).metadata()).toMatchObject({ width: 720, height: 720, hasAlpha: false });
    const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)];
    for (const [x, y] of [[0, 360], [719, 360], [360, 0], [360, 719]]) {
      const [r, g, b] = pixel(x, y);
      expect(Math.abs(r - 24)).toBeLessThan(6);
      expect(Math.abs(g - 64)).toBeLessThan(6);
      expect(Math.abs(b - 40)).toBeLessThan(6);
    }
    expect(pixel(360, 360).every(c => c > 240)).toBe(true);
    expect(await sharp(original).metadata()).toMatchObject({ width, height });
  });

  it('makes transparent artwork opaque without stretching it', async () => {
    const source = await sharp({ create: { width: 100, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const output = await toWalletLogo(source);
    expect(await sharp(output).metadata()).toMatchObject({ width: 720, height: 720, hasAlpha: false });
    expect((await sharp(output).stats()).channels.every(c => c.mean > 250)).toBe(true);
  });
});
