import { expect, test, type Page } from '@playwright/test';
import { DASHBOARD } from '../playwright.config';
import { expectGoodLayout } from '../lib/audit';
import { branches } from '../lib/fixtures';
import { mockApi, signIn } from '../lib/mock-api';
import { KEY_VIEWPORTS, VIEWPORTS } from '../lib/viewports';

/** Dialogs, sheets and menus: opened by a click, so checked on their own. */
const OPENERS: [string, string, (page: Page) => Promise<void>][] = [
  ['scan modal (scanner tab)', '/scan', (p) => p.getByRole('button', { name: /^Scan card/ }).click()],
  [
    'scan modal (camera tab, camera blocked)',
    '/scan',
    async (p) => {
      await p.getByRole('button', { name: /^Scan card/ }).click();
      await p.getByRole('radio', { name: 'Camera' }).click();
    },
  ],
  ['reward dialog', '/rewards', (p) => p.getByRole('button', { name: 'Add reward' }).click()],
  ['qr poster', '/storefront', (p) => p.getByRole('button', { name: 'Get QR' }).click()],
  ['card actions menu', '/card', (p) => p.getByRole('button', { name: 'Card actions' }).click()],
  [
    'card settings',
    '/card',
    async (p) => {
      await p.getByRole('button', { name: 'Card actions' }).click();
      await p.getByRole('menuitem', { name: 'Card settings' }).click();
    },
  ],
  ['period picker', '/activity', (p) => p.getByRole('button', { name: 'Period' }).click()],
  [
    'invite drawer (branch manager)',
    '/settings?tab=team',
    async (p) => {
      await p.getByRole('button', { name: 'Invite', exact: true }).click();
      await p.getByRole('radio', { name: /Branch manager/ }).click();
    },
  ],
];

for (const vp of VIEWPORTS) {
  test.describe(`dialogs · ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, permissions: [] });
    for (const [name, path, open] of OPENERS) {
      test(name, async ({ page }, testInfo) => {
        await mockApi(page, 'vendor_admin');
        await signIn(page);
        // the till remembers the branch picked in this browser (a merchant admin has several)
        await page.addInitScript((id) => localStorage.setItem('dvote-till-branch', id), branches[0].id);
        await page.goto(DASHBOARD + path);
        await page.waitForLoadState('networkidle');
        await open(page);
        await expect(page.locator('[role=dialog], [data-radix-popper-content-wrapper]').first()).toBeVisible();
        await expectGoodLayout(page, testInfo);
      });
    }
  });
}

for (const vp of KEY_VIEWPORTS.filter((v) => v.width < 768)) {
  test.describe(`mobile menu · ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    test('bottom nav · more sheet', async ({ page }, testInfo) => {
      await mockApi(page, 'vendor_admin');
      await signIn(page);
      await page.goto(DASHBOARD + '/');
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('link', { name: 'Home', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'More', exact: true }).click();
      const sheet = page.getByRole('dialog', { name: 'More' });
      await expect(sheet).toBeVisible();
      await sheet.getByRole('link', { name: 'Rewards', exact: true }).click();
      await expect(page).toHaveURL(DASHBOARD + '/rewards');
      await expect(sheet).toBeHidden();
      await page.getByRole('button', { name: 'More', exact: true }).click();
      await expectGoodLayout(page, testInfo);
    });
  });
}

test('invite drawer: the branch picker comes before the role’s permissions', async ({ page }) => {
  await mockApi(page, 'vendor_admin');
  await signIn(page);
  await page.goto(DASHBOARD + '/settings?tab=team');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Invite', exact: true }).click();
  await page.getByRole('radio', { name: /Branch manager/ }).click();
  const branch = await page.getByText('Choose a branch').boundingBox();
  const perms = await page.getByRole('heading', { name: /can do/ }).boundingBox();
  expect(branch && perms && branch.y < perms.y).toBe(true);
});
