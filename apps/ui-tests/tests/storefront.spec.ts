import { expect, test } from '@playwright/test';
import { DASHBOARD } from '../playwright.config';
import { expectGoodLayout } from '../lib/audit';
import { mockApi, signIn } from '../lib/mock-api';
import { VIEWPORTS } from '../lib/viewports';

/** Phones and tablets: the settings come first and the live page opens from a floating Preview button. */
for (const vp of VIEWPORTS.filter((v) => v.width < 1024)) {
  test.describe(`storefront preview · ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    test('preview button opens and closes the phone', async ({ page }, testInfo) => {
      await mockApi(page, 'vendor_admin');
      await signIn(page);
      await page.goto(DASHBOARD + '/storefront');
      await page.waitForLoadState('networkidle');

      // no phone in the page itself: the settings take it
      await expect(page.locator('iframe[title="Storefront preview"]')).toHaveCount(0);
      await expect(page.getByText('Storefront for', { exact: true })).toBeInViewport();

      const fab = page.getByRole('button', { name: 'Preview', exact: true });
      await expect(fab).toBeInViewport();
      await fab.click();
      const sheet = page.getByRole('dialog', { name: 'Storefront preview' });
      await expect(sheet).toBeVisible();
      await expect(sheet.locator('iframe[title="Storefront preview"]')).toBeVisible();
      await expectGoodLayout(page, testInfo);

      await sheet.getByRole('button', { name: 'Close' }).click();
      await expect(sheet).toBeHidden();
      await expect(fab).toBeInViewport();
    });
  });
}

/** Desktop keeps the phone beside the settings, with no floating button. */
test.describe('storefront preview · desktop-1440', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('phone beside the settings', async ({ page }) => {
    await mockApi(page, 'vendor_admin');
    await signIn(page);
    await page.goto(DASHBOARD + '/storefront');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('iframe[title="Storefront preview"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Preview', exact: true })).toBeHidden();
  });
});
