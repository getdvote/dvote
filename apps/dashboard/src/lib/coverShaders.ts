/**
 * Cover templates: 10 soft "mesh" gradients a merchant can pick instead of uploading a banner.
 * Each is a base colour with a few blurred colour blobs on top. The same description is drawn
 * as CSS (previews, the default cover when there is no banner) and on a canvas (the 1600 × 800
 * WebP that is uploaded as the banner), so what the merchant picks is what customers get.
 */

interface Blob {
  /** Centre, in % of the width / height. */
  x: number;
  y: number;
  /** Radii, in % of the width / height. */
  rx: number;
  ry: number;
  /** 6-digit hex. */
  color: string;
}

export interface CoverShader {
  id: string;
  base: string;
  blobs: Blob[];
}

const b = (x: number, y: number, rx: number, ry: number, color: string): Blob => ({ x, y, rx, ry, color });

export const COVER_SHADERS: CoverShader[] = [
  { id: 'sunset', base: '#ff7a59', blobs: [b(8, 15, 55, 90, '#ffd166'), b(88, 10, 50, 85, '#ef476f'), b(72, 100, 60, 90, '#7b2cbf'), b(25, 95, 45, 80, '#ff9f1c')] },
  { id: 'ocean', base: '#0077b6', blobs: [b(10, 10, 55, 90, '#90e0ef'), b(90, 20, 50, 90, '#00b4d8'), b(60, 100, 60, 85, '#023e8a'), b(30, 80, 40, 70, '#48cae4')] },
  { id: 'berry', base: '#7209b7', blobs: [b(15, 20, 55, 90, '#f72585'), b(85, 15, 50, 85, '#ff8fab'), b(70, 95, 55, 90, '#3a0ca3'), b(35, 90, 40, 75, '#b5179e')] },
  { id: 'mint', base: '#2ec4b6', blobs: [b(12, 15, 55, 90, '#e9f5db'), b(85, 25, 50, 85, '#80ed99'), b(65, 100, 55, 90, '#0a9396'), b(30, 85, 40, 70, '#cbf3f0')] },
  { id: 'peach', base: '#ffb4a2', blobs: [b(10, 15, 55, 90, '#ffe5d9'), b(88, 15, 50, 85, '#f4a261'), b(70, 100, 55, 90, '#e5989b'), b(30, 90, 40, 70, '#ffcdb2')] },
  { id: 'lavender', base: '#a594f9', blobs: [b(10, 15, 55, 90, '#f5efff'), b(88, 20, 50, 85, '#cdc1ff'), b(70, 100, 55, 90, '#7371fc'), b(30, 90, 40, 70, '#e5d9f2')] },
  { id: 'coffee', base: '#6f4518', blobs: [b(10, 15, 55, 90, '#e7bc91'), b(88, 15, 50, 85, '#a47148'), b(70, 100, 55, 90, '#3e2a1a'), b(30, 90, 40, 70, '#d4a373')] },
  { id: 'citrus', base: '#ffbe0b', blobs: [b(10, 15, 55, 90, '#ffea00'), b(88, 15, 50, 85, '#fb5607'), b(70, 100, 55, 90, '#ff006e'), b(25, 95, 40, 70, '#8ac926')] },
  { id: 'aurora', base: '#0b132b', blobs: [b(15, 20, 55, 85, '#06d6a0'), b(85, 15, 50, 85, '#3a86ff'), b(70, 100, 55, 90, '#8338ec'), b(35, 85, 40, 70, '#00f5d4')] },
  { id: 'midnight', base: '#10002b', blobs: [b(15, 15, 55, 90, '#5a189a'), b(88, 20, 50, 85, '#e0aaff'), b(70, 100, 55, 90, '#240046'), b(30, 90, 40, 70, '#3c096c')] },
];

/** The cover shown when a merchant has no banner: fixed per merchant, picked from its id. */
export function defaultShader(vendorId: string): CoverShader {
  let h = 0;
  for (const c of vendorId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COVER_SHADERS[h % COVER_SHADERS.length];
}

/** CSS `background` for a shader (first gradient is drawn on top, so blobs are reversed). */
export function shaderCss(s: CoverShader): string {
  const layers = [...s.blobs]
    .reverse()
    .map((p) => `radial-gradient(ellipse ${p.rx}% ${p.ry}% at ${p.x}% ${p.y}%, ${p.color} 0%, ${p.color}00 100%)`);
  return [...layers, s.base].join(', ');
}

/** Draws the shader as a banner-sized WebP file (1600 × 800, the API's banner crop). */
export function renderShader(s: CoverShader, width = 1600, height = 800): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = s.base;
  ctx.fillRect(0, 0, width, height);
  for (const p of s.blobs) {
    ctx.save();
    ctx.translate((p.x / 100) * width, (p.y / 100) * height);
    ctx.scale((p.rx / 100) * width, (p.ry / 100) * height); // a unit circle becomes the ellipse
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, p.color);
    g.addColorStop(1, `${p.color}00`);
    ctx.fillStyle = g;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(new File([blob], `cover-${s.id}.webp`, { type: 'image/webp' })) : reject(new Error('canvas_export_failed'))),
      'image/webp',
      0.92,
    ),
  );
}
