import sharp from 'sharp';

/** A versioned sibling of an immutable uploaded logo; never overwrite a cached image. */
export const walletLogoPath = (path: string) => path.replace(/\.webp$/, '-wallet-v1.webp');
export const logoFiles = (path: string) => [path, walletLogoPath(path)];

/** Keep the artwork intact; extend rectangular logos into an opaque square. */
export async function toWalletLogo(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input).rotate().resize(128, 128, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Quantized mode of visible border pixels is less affected by text/highlights than a mean.
  const bins = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (x > 1 && y > 1 && x < info.width - 2 && y < info.height - 2) continue;
    const at = (y * info.width + x) * 4;
    if (data[at + 3] < 128) continue;
    const [r, g, b] = [data[at], data[at + 1], data[at + 2]];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bin.count++; bin.r += r; bin.g += g; bin.b += b;
    bins.set(key, bin);
  }
  const dominant = [...bins.values()].sort((a, b) => b.count - a.count)[0];
  const background = dominant
    ? { r: Math.round(dominant.r / dominant.count), g: Math.round(dominant.g / dominant.count), b: Math.round(dominant.b / dominant.count) }
    : { r: 255, g: 255, b: 255 };
  return sharp(input).rotate().flatten({ background })
    .resize(720, 720, { fit: 'contain', background })
    .webp({ quality: 90 }).toBuffer();
}
