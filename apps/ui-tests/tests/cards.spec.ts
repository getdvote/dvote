import { expect, test, type Page } from '@playwright/test';
import { DASHBOARD } from '../playwright.config';
import { expectGoodLayout } from '../lib/audit';
import { loyaltyCard } from '../lib/fixtures';
import { mockApi, setLanguage, signIn } from '../lib/mock-api';
import { KEY_VIEWPORTS } from '../lib/viewports';

/** A merchant without a card yet: the Cards page offers the 4-step creation funnel. */
async function withoutCard(page: Page) {
  await page.route('http://api.mock/api/vendor/loyalty-card', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ ...loyaltyCard, card: null, design: null, versions: [], rule: null, canCreate: true, counts: { members: 0, active30d: 0 } }),
    }),
  );
}

const SHOTS = process.env.CARDS_SHOTS;

for (const vp of KEY_VIEWPORTS) {
  for (const language of ['en', 'ar'] as const) {
    test(`card funnel · ${language} · ${vp.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      if (language === 'ar') await setLanguage(page, 'ar');
      await mockApi(page, 'vendor_admin');
      await withoutCard(page);
      await signIn(page);
      await page.goto(DASHBOARD + '/card');
      await page.getByRole('button', { name: language === 'en' ? 'Create my card' : 'إنشاء بطاقتي' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      const next = dialog.getByRole('button', { name: language === 'en' ? 'Next' : 'التالي' });
      await dialog.getByRole('textbox').fill('Joy Corner Rewards');
      for (const step of ['name', 'points', 'look', 'review']) {
        await expectGoodLayout(page, testInfo);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/funnel-${step}-${language}-${vp.name}.png` });
        if (step !== 'review') await next.click();
      }
      await expect(dialog.getByRole('button', { name: language === 'en' ? 'Create card' : 'إنشاء البطاقة' })).toBeEnabled();
    });
  }
}

/** The editor with 7 saved versions: History shows 5 a page; hours are one time per day, Sunday first. */
for (const vp of KEY_VIEWPORTS) {
  test(`card editor history + hours · ${vp.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await mockApi(page, 'vendor_admin');
    const versions = [7, 6, 5, 4, 3, 2, 1].map((n) => ({ ...loyaltyCard.versions[0], id: `version-${n}`, number: n, live: n === 7 }));
    await page.route('http://api.mock/api/vendor/loyalty-card', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ ...loyaltyCard, versions, card: { ...loyaltyCard.card, liveVersionId: 'version-7' } }),
      }),
    );
    await signIn(page);
    await page.goto(DASHBOARD + '/card/design');
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
    await expectGoodLayout(page, testInfo);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/editor-look-${vp.name}.png` });

    // back of the card: Sunday first, one time per day, picked in a popover
    await page.getByRole('tab', { name: 'Back of the card' }).click();
    const days = page.locator('fieldset', { hasText: 'Opening hours' }).locator('li');
    await expect(days).toHaveCount(7);
    await expect(days.first()).toContainText('Sunday');
    await page.getByRole('button', { name: 'Sunday · Opens' }).click();
    await expect(page.getByRole('listbox', { name: 'Hour' })).toBeVisible();
    await expectGoodLayout(page, testInfo);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/editor-time-picker-${vp.name}.png` });
    await page.getByRole('option', { name: '10' }).first().click();
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByRole('button', { name: 'Sunday · Opens' })).toContainText('10:00');
    await expect(page.getByText('Unsaved changes')).toBeVisible();

    // history: 5 versions a page
    await page.getByRole('tab', { name: 'History' }).click();
    const history = page.locator('li', { hasText: /^V\d/ });
    await expect(history).toHaveCount(5);
    await expect(page.getByText('Page 1 of 2')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(history).toHaveCount(2);

    // leaving with unsaved changes asks in the dashboard's own dialog
    await page.getByRole('link', { name: 'Cards' }).first().click();
    const leave = page.getByRole('alertdialog');
    await expect(leave).toContainText('Leave without saving?');
    await expectGoodLayout(page, testInfo);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/editor-leave-dialog-${vp.name}.png` });
    await leave.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page).toHaveURL(/\/card\/design/);
  });
}
