import { test, expect } from '@playwright/test';
import { DASHBOARD } from '../playwright.config';
import { mockApi, signIn } from '../lib/mock-api';
import { VENDOR_ID } from '../lib/fixtures';
import { WORKSPACE_PAGES } from '../../dashboard/src/lib/workspace-pages';

for (const selected of [false, true]) {
  for (const item of WORKSPACE_PAGES) {
    test(`admin workspace ${item.section} ${selected ? 'selected merchant' : 'all merchants'}`, async ({ page }) => {
      const errors: string[] = [];
      const merchantRequests: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('request', (req) => {
        if (req.url().startsWith('http://api.mock/api/vendor/')) merchantRequests.push(req.url());
      });
      await mockApi(page, 'admin');
      await signIn(page);
      await page.goto(`${DASHBOARD}/${item.section}${selected ? '?vendor=' + VENDOR_ID : ''}`);
      await expect(page.getByRole('heading', { name: item.label, exact: true }).first()).toBeVisible();
      if (selected && item.section !== 'audit') {
        await expect(
          page.getByText('Managing this merchant as a dvote platform admin.', {
            exact: false,
          }),
        ).toBeVisible();
        await expect(page.getByRole('status').filter({ hasText: 'Loading merchant workspace' })).toHaveCount(0);
      } else await expect(page.getByText('Workspace record', { exact: true })).toBeVisible();
      // Card includes an informational points-calculation preview rendered as an alert.
      await expect(page.locator('[role="alert"]')).toHaveCount(selected && item.section === 'card' ? 1 : 0);
      expect(errors).toEqual([]);
      expect(merchantRequests).toEqual([]);
    });
  }
}

test('merchant selection and internal links keep the admin workspace', async ({ page }) => {
  await mockApi(page, 'admin');
  await signIn(page);
  await page.goto(DASHBOARD + '/storefront');
  await page.getByRole('combobox', { name: 'Merchant', exact: true }).selectOption(VENDOR_ID);
  await expect(page).toHaveURL(new RegExp('vendor=' + VENDOR_ID));
  const feedback = page.getByRole('link', { name: /view feedback/i });
  if (await feedback.count()) await expect(feedback).toHaveAttribute('href', new RegExp('/customer-feedback.*vendor=' + VENDOR_ID));
  await page.getByRole('combobox', { name: 'Merchant', exact: true }).selectOption('');
  await expect(page.getByText('Workspace record', { exact: true })).toBeVisible();
});

test('all-merchants view fits a phone in dark mode', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await mockApi(page, 'admin'); await signIn(page);
  await page.goto(DASHBOARD + '/activity');
  await expect(page.getByText('Workspace record', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test('clicking Till again returns from a merchant to all merchants', async ({ page }) => {
  await mockApi(page, 'admin'); await signIn(page);
  await page.goto(DASHBOARD + '/scan');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Merchant', exact: true })).toHaveValue(VENDOR_ID);
  await page.getByRole('link', { name: 'Till', exact: true }).click();
  await expect(page).toHaveURL(DASHBOARD + '/scan');
  await expect(page.getByRole('combobox', { name: 'Merchant', exact: true })).toHaveValue('');
  await expect(page.getByText('Workspace record', { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('combobox', { name: 'Merchant', exact: true })).toHaveValue(VENDOR_ID);
});

test('merchant tabs preserve selection but sidebar page links reset it', async ({ page }) => {
  await mockApi(page, 'admin'); await signIn(page);
  await page.goto(DASHBOARD + '/rewards?vendor=' + VENDOR_ID);
  await page.getByRole('tab', { name: /redemptions/i }).click();
  await expect(page).toHaveURL(new RegExp('vendor=' + VENDOR_ID));
  await expect(page.getByRole('combobox', { name: 'Merchant', exact: true })).toHaveValue(VENDOR_ID);
  await page.getByRole('link', { name: 'Insights', exact: true }).click();
  await expect(page).toHaveURL(DASHBOARD + '/insights');
  await expect(page.getByRole('combobox', { name: 'Merchant', exact: true })).toHaveValue('');
});
