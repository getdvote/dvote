import { expect, test, type Page } from '@playwright/test';
import { DASHBOARD, LANDING } from '../playwright.config';
import { mockApi } from '../lib/mock-api';

const SECRET = 'b'.repeat(32);
const API = 'http://api.mock';
const direction = (page: Page) => page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir }));
/** Before any script of the page runs: what the very first paint would use. */
const firstPaint = (page: Page, url: string) =>
  page.request.get(url).then(async (r) => {
    const html = await r.text();
    return { lang: /<html[^>]*lang="(\w+)"/.exec(html)?.[1], dir: /<html[^>]*dir="(\w+)"/.exec(html)?.[1] };
  });

// an English browser, the case the old defaults followed
test.use({ locale: 'en-US', viewport: { width: 1280, height: 800 } });

test.describe('dashboard', () => {
  test('a first visit is in Arabic, right to left', async ({ page }) => {
    await mockApi(page, 'vendor_admin', { firstVisit: true });
    await page.goto(`${DASHBOARD}/login`);
    await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
    expect(await direction(page)).toEqual({ lang: 'ar', dir: 'rtl' });
  });

  test('starts right to left in the page itself, so it never flashes', async ({ page }) => {
    expect(await firstPaint(page, `${DASHBOARD}/login`)).toEqual({ lang: 'ar', dir: 'rtl' });
  });

  test('choosing English is remembered', async ({ page }) => {
    await mockApi(page, 'vendor_admin', { firstVisit: true });
    await page.goto(`${DASHBOARD}/login`);
    await page.getByRole('button', { name: 'اللغة' }).click();
    await page.getByRole('menuitemradio', { name: 'English' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(await direction(page)).toEqual({ lang: 'en', dir: 'ltr' });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(await direction(page)).toEqual({ lang: 'en', dir: 'ltr' });
  });

  test('a saved English choice stays English', async ({ page }) => {
    await mockApi(page, 'vendor_admin', { firstVisit: true });
    await page.addInitScript(() => localStorage.setItem('dvote-dashboard-language', 'en'));
    await page.goto(`${DASHBOARD}/login`);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(await direction(page)).toEqual({ lang: 'en', dir: 'ltr' });
  });
});

test.describe('phone pairing', () => {
  test('the code form is in Arabic on a new phone', async ({ page }) => {
    await mockApi(page, 'staff', { firstVisit: true });
    await page.route(`${API}/**`, (route) => route.fallback());
    await page.goto(`${DASHBOARD}/pair#${SECRET}`);
    await expect(page.getByRole('heading', { name: 'اربط هذا الهاتف' })).toBeVisible();
    expect(await direction(page)).toEqual({ lang: 'ar', dir: 'rtl' });
  });
});

test.describe('landing page', () => {
  const blockApi = (page: Page) => page.route(`${API}/**`, (route) => route.abort());

  test('a first visit from an English browser is in Arabic', async ({ page }) => {
    await blockApi(page);
    await page.goto(LANDING);
    await expect(page.locator('h1')).toContainText('كارت');
    expect(await direction(page)).toEqual({ lang: 'ar', dir: 'rtl' });
  });

  test('starts right to left in the page itself, so it never flashes', async ({ page }) => {
    expect(await firstPaint(page, LANDING)).toEqual({ lang: 'ar', dir: 'rtl' });
  });

  test('a saved English choice stays English', async ({ page }) => {
    await blockApi(page);
    await page.addInitScript(() => localStorage.setItem('dvote-landing-language', 'en'));
    await page.goto(LANDING);
    await expect(page.locator('h1')).not.toContainText('كارت');
    expect(await direction(page)).toEqual({ lang: 'en', dir: 'ltr' });
  });
});
