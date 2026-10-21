import { expect, test, type Page } from '@playwright/test';
import { DASHBOARD } from '../playwright.config';
import { expectGoodLayout } from '../lib/audit';
import { staffMe } from '../lib/fixtures';
import { mockApi, setLanguage, signIn } from '../lib/mock-api';
import { KEY_VIEWPORTS } from '../lib/viewports';

/** Self sign-up and the 7-day free trial: sign-up page, trial banner, "trial ended" screen. */
const DAY = 86_400_000;

async function trialMe(page: Page, daysLeft: number) {
  await page.route('http://api.mock/api/vendor/staff/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...staffMe('vendor_admin'),
        vendor: {
          ...staffMe('vendor_admin').vendor,
          plan: {
            status: 'trial',
            plan: null,
            trialEndsAt: new Date(Date.now() + daysLeft * DAY - 60_000).toISOString(),
            deleteAt: new Date(Date.now() + (daysLeft + 23) * DAY).toISOString(),
          },
        },
      }),
    }),
  );
}

async function trialEnded(page: Page) {
  await page.route('http://api.mock/api/vendor/staff/me', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'trial_ended', trialEndedAt: '2026-10-28T10:00:00.000Z', deleteAt: '2026-11-20T10:00:00.000Z' }),
    }),
  );
}

for (const vp of KEY_VIEWPORTS) {
  for (const lang of ['en', 'ar'] as const) {
    test.describe(`trial · ${lang} · ${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test('sign-up page', async ({ page }, testInfo) => {
        await setLanguage(page, lang);
        await mockApi(page, 'vendor_admin');
        await page.goto(DASHBOARD + '/signup');
        await expect(page.locator('#shopName')).toBeVisible();
        if (lang === 'en') await expect(page.getByRole('heading', { name: 'Start your free trial' })).toBeVisible();
        await expectGoodLayout(page, testInfo);
      });

      test('trial banner', async ({ page }, testInfo) => {
        await setLanguage(page, lang);
        await mockApi(page, 'vendor_admin');
        await trialMe(page, 3);
        await signIn(page);
        await page.goto(DASHBOARD + '/');
        if (lang === 'en') await expect(page.getByText('Free trial: 3 days left')).toBeVisible();
        await expect(page.locator('a[href="https://dvote.co/pricing"]').first()).toBeVisible();
        await expectGoodLayout(page, testInfo);
      });

      test('trial ended screen', async ({ page }, testInfo) => {
        await setLanguage(page, lang);
        await mockApi(page, 'vendor_admin');
        await trialEnded(page);
        await signIn(page);
        await page.goto(DASHBOARD + '/');
        if (lang === 'en') {
          await expect(page.getByText('Your free trial has ended')).toBeVisible();
          await expect(page.getByText(/deleted for good on 20 November 2026/)).toBeVisible();
        }
        await expect(page.locator('a[href="https://dvote.co/pricing"]')).toBeVisible();
        await expectGoodLayout(page, testInfo);
      });
    });
  }
}

test('sign-in page links to the free trial (merchant), and the sign-up page has the account fields', async ({ page }) => {
  await setLanguage(page, 'en');
  await mockApi(page, 'vendor_admin');
  await page.goto(DASHBOARD + '/');
  await page.getByRole('link', { name: 'Start a 7-day free trial' }).click();
  await expect(page).toHaveURL(/\/signup$/);
  for (const id of ['ownerName', 'shopName', 'email', 'phone', 'password']) await expect(page.locator(`#${id}`)).toBeVisible();
});

test('sign-up sends the form to the API and shows "check your email"', async ({ page }) => {
  await setLanguage(page, 'en');
  await mockApi(page, 'vendor_admin');
  let sent: Record<string, unknown> | null = null;
  await page.route('http://api.mock/api/public/merchant-signup', async (route) => {
    sent = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sent: true }) });
  });
  await page.goto(DASHBOARD + '/signup');
  await page.fill('#ownerName', 'Sara Owner');
  await page.fill('#shopName', 'Sara Cafe');
  await page.fill('#email', 'sara@example.com');
  await page.fill('#phone', '011 2345 6789');
  await page.fill('#password', 'secret-pass-1');
  await page.getByRole('button', { name: 'Create my shop' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  expect(sent).toMatchObject({ ownerName: 'Sara Owner', shopName: 'Sara Cafe', email: 'sara@example.com', phone: '+201123456789', password: 'secret-pass-1' });
});
