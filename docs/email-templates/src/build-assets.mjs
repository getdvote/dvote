// Renders the email images (animated hero cards, pattern tile, logos) into apps/web/public/email,
// then copies them to apps/landing/public/email. The emails load them from https://dvote.co/email/…,
// which today is the customer website and later the landing page (DEPLOY.md), so both ship them.
// Run: node docs/email-templates/src/build-assets.mjs
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '../../..');
const sharp = createRequire(join(repo, 'apps/api/package.json'))('sharp');
const out = join(repo, 'apps/web/public/email');
mkdirSync(out, { recursive: true });

// Brand kit palette (output/dvote brand/dvote-brand-kit/tokens).
const Y = '#E1FF00', K = '#11190C', M = '#CAC4B7', P = '#F3F1EE', W = '#FFFFFF', G = '#787664';

const logoPaths = [...readFileSync(join(here, 'dvote-logo.svg'), 'utf8').matchAll(/<path[^>]*d="([^"]+)"/g)].map((m) => m[1]);
const SYMBOL_W = 208, LOGO_W = 665;

// Same primitives as the brand kit generator, so the shapes match the kit illustrations.
const g = (s, x = 0, y = 0, k = 1, extra = '') => `<g transform="translate(${x} ${y}) scale(${k})" ${extra}>${s}</g>`;
const rect = (x, y, w, h, fill = P, r = 0, stroke, sw = 1) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`;
const circle = (x, y, r, c = Y, stroke, sw = 2) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`;
const path = (d, fill = 'none', stroke = K, sw = 2, extra = '') =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const logo = (x, y, w = 220, c = K, symbolOnly = false) =>
  g((symbolOnly ? logoPaths.slice(0, 5) : logoPaths).map((d) => `<path d="${d}" fill="${c}"/>`).join(''), x, y, w / (symbolOnly ? SYMBOL_W : LOGO_W));
// Symbol centred on (cx, cy), rotated by deg and scaled to width w.
const symbol = (cx, cy, w, c = K, deg = 0) =>
  `<g transform="translate(${cx} ${cy}) rotate(${deg}) scale(${w / SYMBOL_W}) translate(-103.4 -104)">${logoPaths.slice(0, 5).map((d) => `<path d="${d}" fill="${c}"/>`).join('')}</g>`;
const spark = (x, y, r = 18, c = Y) =>
  r <= 0.5 ? '' : path(`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}`, c, c, 1);
const base = () => circle(320, 240, 180, P) + path('M95 394H545', 'none', M, 2);
const svg = (body, w = 640, h = 480) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${W}"/>${body}</svg>`;

// Motion helpers. t runs 0→1 across the animated part of the loop.
const clamp = (v) => Math.min(1, Math.max(0, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const outBack = (x) => { const c = 1.70158; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
const outCubic = (x) => 1 - (1 - x) ** 3;
const twinkle = (t, phase = 0) => 0.7 + 0.3 * Math.sin((t + phase) * Math.PI * 4);

// Each card: draw(t) → SVG body. Frames ease in, then hold on the finished state (what non-animating clients show first).
const cards = {
  // Invite: a loyalty card fills up stamp by stamp.
  invite(t) {
    const tilt = -4 * (1 - outCubic(seg(t, 0, 0.25)));
    let stamps = '';
    for (let i = 0; i < 5; i++) {
      const p = outBack(seg(t, 0.15 + i * 0.13, 0.3 + i * 0.13));
      const cx = 44 + i * 58, cy = 102;
      stamps += i < 4 || p === 0 ? circle(cx, cy, 20, 'none', K, 3) : '';
      if (p > 0) stamps += symbol(cx, cy, 40 * p, K, (1 - p) * -120);
    }
    const card = rect(0, 0, 350, 220, K, 24) + rect(-12, -12, 350, 220, Y, 24, K, 4) + logo(18, 14, 96) + stamps + path('M72 155h190', 'none', K, 4);
    const done = seg(t, 0.85, 1);
    return base() + g(card, 150, 145, 1, `transform-origin="325 255"`).replace('scale(1)', `scale(1) rotate(${tilt} 175 110)`) +
      spark(500, 95, 29 * twinkle(t) * (0.4 + 0.6 * done)) + spark(100, 265, 16 * twinkle(t, 0.25)) + spark(540, 300, 14 * outBack(done));
  },
  // Reset password: dots fill the field, the lock snaps shut.
  'reset-password'(t) {
    const shut = outBack(seg(t, 0.7, 0.85));
    const lift = 34 * (1 - shut);
    let dots = '';
    for (let i = 0; i < 6; i++) {
      const p = outBack(seg(t, 0.1 + i * 0.09, 0.2 + i * 0.09));
      if (p > 0) dots += circle(222 + i * 39, 320, 9 * p, K);
    }
    const body = rect(242, 186, 172, 124, K, 22) + rect(232, 176, 172, 124, Y, 22, K, 4);
    const shackle = path(`M262 ${176 - lift}V${136 - lift}a56 56 0 0 1 112 0V${176 - lift}`, 'none', K, 14);
    const keyhole = circle(318, 228, 13, K) + rect(312, 232, 12, 32, K, 6);
    const field = rect(186, 290, 268, 60, K, 16) + rect(180, 284, 268, 60, W, 16, K, 4);
    return base() + shackle + body + keyhole + field + dots +
      spark(488, 128, 28 * twinkle(t)) + spark(140, 170, 18 * twinkle(t, 0.3)) + spark(470, 246, 16 * outBack(seg(t, 0.85, 1)));
  },
  // Confirm sign up: the check draws itself.
  'confirm-signup'(t) {
    const pop = outBack(seg(t, 0, 0.3));
    const draw = outCubic(seg(t, 0.3, 0.7));
    const len = 210;
    return base() + g(circle(15, 15, 133, K) + circle(0, 0, 133, Y, K, 4), 315, 230, pop) +
      path('m250 230 44 45 91-97', 'none', K, 14, `stroke-dasharray="${len}" stroke-dashoffset="${len * (1 - draw)}"`) +
      spark(125, 125, 28 * twinkle(t)) + spark(500, 340, 32 * outBack(seg(t, 0.7, 0.9))) +
      path('M470 115L492 90', 'none', K, 4) + path('M180 362L165 389', 'none', K, 4);
  },
  // Magic link: the envelope arrives and its symbol seal spins (like the logo hover in the dashboard).
  'magic-link'(t) {
    const fly = outCubic(seg(t, 0, 0.35));
    const x = -120 * (1 - fly), y = 30 * (1 - fly);
    const spin = 360 * outCubic(seg(t, 0.35, 0.85));
    const env = rect(14, 14, 300, 196, K, 18) + rect(0, 0, 300, 196, W, 18, K, 4) +
      path('M8 12L150 116L292 12', 'none', K, 4) + path('M8 188L118 92M292 188L182 92', 'none', K, 4) +
      circle(150, 116, 40, Y, K, 4) + symbol(150, 116, 52, K, spin);
    return base() + g(env, 170 + x, 132 + y) +
      spark(500, 100, 26 * twinkle(t)) + spark(118, 150, 18 * twinkle(t, 0.4)) + spark(520, 330, 14 * outBack(seg(t, 0.8, 1)));
  },
  // Change email: the card slides from the old address to the new one.
  'change-email'(t) {
    const move = outCubic(seg(t, 0.15, 0.6));
    const fade = 1 - seg(t, 0.15, 0.4);
    const mail = (x, y, fill, op = 1) => g(rect(8, 8, 150, 100, K, 12) + rect(0, 0, 150, 100, fill, 12, K, 4) + path('M6 8L75 60L144 8', 'none', K, 4), x, y, 1, `opacity="${op}"`);
    const arrow = path(`M250 250H${250 + 140 * move}`, 'none', K, 6) + (move > 0.9 ? path('M372 234l18 16-18 16', 'none', K, 6) : '');
    const check = outBack(seg(t, 0.65, 0.85));
    return base() + mail(100, 200, P, 0.35 + 0.65 * fade) + arrow + mail(390, 200, Y) +
      g(circle(0, 0, 22, K) + path('m-9 0 6 6 12-13', 'none', Y, 5), 540, 200, check) +
      spark(470, 120, 26 * twinkle(t)) + spark(160, 140, 18 * twinkle(t, 0.3));
  },
  // Reauthentication: a code fills in, box by box.
  reauthentication(t) {
    let boxes = '';
    for (let i = 0; i < 6; i++) {
      const p = outBack(seg(t, 0.08 + i * 0.1, 0.2 + i * 0.1));
      const x = 140 + i * 62;
      boxes += rect(x + 5, 205, 50, 66, K, 12) + rect(x, 200, 50, 66, p > 0.5 ? Y : W, 12, K, 4);
      if (p > 0) boxes += circle(x + 25, 233, 9 * p, K);
    }
    const shield = g(path('M0 -38L32 -26V0C32 22 16 36 0 44C-16 36 -32 22 -32 0V-26Z', Y, K, 4) + path('m-12 2 9 9 17-19', 'none', K, 5), 320, 132, outBack(seg(t, 0.7, 0.9)));
    return base() + boxes + shield + spark(505, 120, 26 * twinkle(t)) + spark(130, 330, 16 * twinkle(t, 0.3));
  },
};

const FRAMES = 30, FRAME_MS = 60, HOLD_MS = 1800, SCALE = 800 / 640;

async function renderCard(name, draw) {
  const frames = [];
  const delays = [];
  for (let f = 0; f <= FRAMES; f++) {
    const t = f / FRAMES;
    frames.push(await sharp(Buffer.from(svg(draw(t)))).resize(Math.round(640 * SCALE)).png().toBuffer());
    delays.push(f === FRAMES ? HOLD_MS : FRAME_MS);
  }
  // Put the finished state first so clients that only show frame 1 (Outlook on Windows) still see the complete picture.
  const ordered = [frames.at(-1), ...frames.slice(0, -1)];
  const orderedDelays = [HOLD_MS, ...delays.slice(0, -1)];
  await sharp(ordered, { join: { animated: true } })
    .gif({ delay: orderedDelays, loop: 0, colours: 32, effort: 10, dither: 0 })
    .toFile(join(out, `${name}.gif`));
}

for (const [name, draw] of Object.entries(cards)) await renderCard(name, draw);

// Background pattern tile: scattered symbols and sparks on ink, quiet enough to sit behind text.
const tile = 240;
const tileBody = rect(0, 0, tile, tile, K) +
  symbol(40, 46, 30, '#2B3424', 20) + symbol(170, 120, 22, '#2B3424', -30) + symbol(86, 196, 26, '#2B3424', 60) +
  spark(200, 30, 7, '#3A4A12') + spark(120, 70, 5, '#3A4A12') + spark(26, 140, 6, '#3A4A12') + spark(212, 214, 6, '#3A4A12');
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${tile}">${tileBody}</svg>`)).resize(tile * 2).png().toFile(join(out, 'pattern-ink.png'));

// Logos: electric lockup for the ink header, electric symbol for the footer.
const lockup = (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 665 208">${logoPaths.map((d) => `<path d="${d}" fill="${c}"/>`).join('')}</svg>`;
await sharp(Buffer.from(lockup(Y))).resize(280).png().toFile(join(out, 'logo-electric.png'));
const sym = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 208 208">${logoPaths.slice(0, 5).map((d) => `<path d="${d}" fill="${Y}"/>`).join('')}</svg>`;
await sharp(Buffer.from(sym)).resize(96).png().toFile(join(out, 'symbol-electric.png'));

// Underline under the headline: a hand-drawn ink stroke with an electric spark.
const underline = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="24" viewBox="0 0 240 24">${path('M6 14C50 6 110 6 160 11S220 16 204 12', 'none', K, 3)}${path('M30 19C80 14 140 15 190 18', 'none', K, 2)}${spark(226, 10, 8, Y).replace('stroke-width="1"', 'stroke-width="1"')}${path('M226 2Q226 10 234 10Q226 10 226 18Q226 10 218 10Q226 10 226 2', 'none', K, 1.5)}</svg>`;
await sharp(Buffer.from(underline)).resize(480).png().toFile(join(out, 'underline.png'));

for (const f of ['pattern-ink.png', 'logo-electric.png', 'symbol-electric.png', 'underline.png', ...Object.keys(cards).map((n) => `${n}.gif`)]) {
  console.log(f.padEnd(26), `${(statSync(join(out, f)).size / 1024).toFixed(0)} KB`);
}

// dvote.co moves from apps/web to apps/landing: keep the same files in both.
const { cpSync } = await import('node:fs');
cpSync(out, join(repo, 'apps/landing/public/email'), { recursive: true });
