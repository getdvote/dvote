import { randomUUID } from 'node:crypto';
import { UnsupportedMediaTypeException } from '@nestjs/common';
import sharp from 'sharp';

/**
 * Every uploaded image is re-encoded as WebP at a sensible size. Re-encoding also proves the
 * file really is an image (a renamed .exe fails here) and strips its metadata (GPS etc.).
 */
export const IMAGE_PRESETS = {
  /** Profile photo: square, cropped to fill. */
  avatar: { width: 512, height: 512, fit: 'cover' },
  /** Shop-page banner: wide (2:1), cropped to fill. */
  banner: { width: 1600, height: 800, fit: 'cover' },
  /** Shop logo: fits in a square, never cropped. */
  logo: { width: 512, height: 512, fit: 'inside' },
  /** Menu page: big enough to read the prices. */
  menu: { width: 1600, height: 1600, fit: 'inside' },
  /** Photo of a branch. */
  branch_photo: { width: 1280, height: 1280, fit: 'inside' },
  /** Photo of a reward (the coffee, the cake): shown on reward cards in the app. */
  reward: { width: 1000, height: 1000, fit: 'inside' },
} as const satisfies Record<string, { width: number; height: number; fit: 'cover' | 'inside' }>;
export type ImagePreset = keyof typeof IMAGE_PRESETS;

/** Formats people actually upload; sharp decodes all of them. */
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif', 'avif', 'gif']);

export const IMAGE_CONTENT_TYPE = 'image/webp';

export async function toWebp(input: Buffer, preset: ImagePreset): Promise<Buffer> {
  const { width, height, fit } = IMAGE_PRESETS[preset];
  try {
    const { format } = await sharp(input).metadata();
    if (!format || !ACCEPTED_FORMATS.has(format)) throw new Error(`format ${format}`);
    return await sharp(input, { animated: false })
      .rotate() // respect the phone's orientation flag, then drop it
      .resize({ width, height, fit, withoutEnlargement: fit === 'inside' })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new UnsupportedMediaTypeException({
      code: 'unsupported_image',
      message: 'Upload a JPG, PNG, WebP or HEIC image',
    });
  }
}

/** A new, never-reused file name: files never change, so URLs can be cached forever. */
export const newImageName = () => `${randomUUID()}.webp`;
