// Dark mode versions of the brand scenes, so they sit directly on dark surfaces with no light panel.
// Run after changing a scene: node scripts/build-dark-illustrations.mjs
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '../public/brand/illustrations');
const out = join(dir, 'dark');
mkdirSync(out, { recursive: true });

// scenes where the dvote symbol sits on a dark surface, so it has to turn light too
const LIGHT_SYMBOL = new Set(['empty-rewards.svg', 'scan-and-earn.svg']);

function toDark(svg, file) {
  const base = LIGHT_SYMBOL.has(file) ? svg.replace(/(<path\b[^>]*?)fill="#18100F"/gi, '$1fill="#D4D4D8"') : svg;
  return (
    base
      // the soft circle behind each scene becomes a faint glow that suits any dark surface
      .replace(/(<circle cx="320" cy="240" r="\d+" )fill="#F8F4F1"/i, '$1fill="#FAFAFA" fill-opacity="0.06"')
      // ink: outlines turn light, solid shapes (hard shadows, doors) stay dark
      .replace(/stroke="#18100F"/gi, 'stroke="#D4D4D8"')
      .replace(/fill="#18100F"/gi, 'fill="#09090B"')
      .replace(/#F8F4F1/gi, '#27272A')
      .replace(/#FFFFFF/gi, '#18181A')
      .replace(/#E4DCD4/gi, '#3F3F46')
      .replace(/#1F3DFF/gi, '#6F86FF')
  );
}

for (const file of readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
  writeFileSync(join(out, file), toDark(readFileSync(join(dir, file), 'utf8'), file));
}
