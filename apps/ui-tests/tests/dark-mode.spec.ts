import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DASHBOARD } from '../playwright.config';
import { mockApi } from '../lib/mock-api';

const ART = join(import.meta.dirname, '../../dashboard/public/brand/illustrations');
const dark = (page: Page) => page.addInitScript(() => localStorage.setItem('dvote-dashboard-theme', 'dark'));
const hex = (v: string) => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(v.trim());
  if (!m) throw new Error(`not a hex colour: ${v}`);
  return [m[1], m[2], m[3]].map((c) => parseInt(c, 16));
};
const luminance = (v: string) => {
  const [r, g, b] = hex(v).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const token = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(`--${n}`).trim(), name);

test.use({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });

test.describe('dark mode colours', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, 'vendor_admin');
    await dark(page);
    await page.goto(`${DASHBOARD}/login`);
    await expect(page.locator('html.dark')).toHaveCount(1);
  });

  for (const name of ['background', 'card', 'popover', 'secondary', 'muted', 'accent', 'border', 'input', 'sidebar', 'sidebar-accent', 'brand-soft', 'info-soft']) {
    test(`${name} is a plain grey, not brown or blue`, async ({ page }) => {
      const [r, g, b] = hex(await token(page, name));
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(8);
    });
  }

  for (const [text, surface, min] of [
    ['foreground', 'background', 4.5],
    ['foreground', 'card', 4.5],
    ['muted-foreground', 'card', 4.5],
    ['muted-foreground', 'background', 4.5],
    ['brand-text', 'card', 4.5],
    ['brand-text', 'brand-soft', 4.5],
    ['brand-foreground', 'brand', 4.5],
    ['primary-foreground', 'primary', 4.5],
    ['input', 'card', 3],
  ] as const) {
    test(`${text} on ${surface} is readable`, async ({ page }) => {
      expect(contrast(await token(page, text), await token(page, surface))).toBeGreaterThanOrEqual(min);
    });
  }
});

test.describe('dark mode illustrations', () => {
  const visibleArt = (page: Page) => page.locator('img[src*="brand/illustrations"]:visible').first();

  test('have no light panel behind them', async ({ page }) => {
    await mockApi(page, 'vendor_admin');
    await dark(page);
    await page.goto(`${DASHBOARD}/login`);
    const art = visibleArt(page);
    await expect(art).toHaveAttribute('src', /illustrations\/dark\//);
    const background = await art.evaluate((el) => getComputedStyle(el.parentElement!).backgroundColor);
    expect(background).toBe('rgba(0, 0, 0, 0)');
  });

  test('keep the normal drawing in light mode', async ({ page }) => {
    await mockApi(page, 'vendor_admin');
    await page.addInitScript(() => localStorage.setItem('dvote-dashboard-theme', 'light'));
    await page.goto(`${DASHBOARD}/login`);
    await expect(visibleArt(page)).not.toHaveAttribute('src', /illustrations\/dark\//);
  });

  const scenes = readdirSync(ART).filter((f) => f.endsWith('.svg'));
  test('every drawing has a dark version with no light or brown colours', () => {
    expect(scenes.length).toBeGreaterThan(0);
    for (const scene of scenes) {
      const svg = readFileSync(join(ART, 'dark', scene), 'utf8').toUpperCase();
      for (const colour of ['#F8F4F1', '#FFFFFF', '#18100F', '#E4DCD4', '#1F3DFF']) {
        expect(svg, `${scene} still uses ${colour}`).not.toContain(colour);
      }
    }
  });

  test('every drawing keeps its shapes in the dark version', () => {
    for (const scene of scenes) {
      const count = (s: string) => (s.match(/<(path|rect|circle|g)\b/g) ?? []).length;
      expect(count(readFileSync(join(ART, 'dark', scene), 'utf8'))).toBe(count(readFileSync(join(ART, scene), 'utf8')));
    }
  });
});

test('the sign-in side panel is not brown in dark mode', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockApi(page, 'vendor_admin');
  await dark(page);
  await page.goto(`${DASHBOARD}/login`);
  const panel = page.locator('[data-testid="login-panel"]');
  await expect(panel).toBeVisible();
  const rgb = await panel.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(rgb).not.toBe('rgb(24, 16, 15)');
});
