import { test } from '@playwright/test';
import { DASHBOARD } from '../playwright.config';
import { expectGoodLayout } from '../lib/audit';
import { mockApi, setLanguage, signIn } from '../lib/mock-api';
import { KEY_VIEWPORTS, VIEWPORTS } from '../lib/viewports';

/** Every merchant page, signed in as a merchant admin (sees everything). */
const PAGES = [
  ['home', '/'],
  ['scan', '/scan'],
  ['customers', '/customers'],
  ['customers-segments', '/customers?tab=segments'],
  ['insights', '/insights'],
  ['activity', '/activity'],
  ['branches', '/branches'],
  ['card', '/card'],
  ['rewards', '/rewards'],
  ['rewards-redemptions', '/rewards?tab=redemptions'],
  ['storefront', '/storefront'],
  ['settings-general', '/settings?tab=general'],
  ['settings-team', '/settings?tab=team'],
  ['settings-branding', '/settings?tab=branding'],
  ['feedback', '/feedback'],
  ['broadcast', '/broadcast'],
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`merchant · ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    for (const [name, path] of PAGES) {
      test(name, async ({ page }, testInfo) => {
        await mockApi(page, 'vendor_admin');
        await signIn(page);
        await page.goto(DASHBOARD + path);
        await expectGoodLayout(page, testInfo);
      });
    }
  });
}

for (const vp of KEY_VIEWPORTS) {
  test.describe(`merchant · arabic · ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    for (const [name, path] of PAGES) {
      test(name, async ({ page }, testInfo) => {
        await setLanguage(page, 'ar');
        await mockApi(page, 'vendor_admin');
        await signIn(page);
        await page.goto(DASHBOARD + path);
        await expectGoodLayout(page, testInfo);
      });
    }
  });
}

/** Branch managers and cashiers see a reduced app (different sidebar and pages). */
for (const vp of KEY_VIEWPORTS) {
  test.describe(`merchant · other roles · ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    test('branch manager home', async ({ page }, testInfo) => {
      await mockApi(page, 'branch_manager');
      await signIn(page);
      await page.goto(DASHBOARD + '/');
      await expectGoodLayout(page, testInfo);
    });
    test('cashier scan', async ({ page }, testInfo) => {
      await mockApi(page, 'staff');
      await signIn(page);
      await page.goto(DASHBOARD + '/scan');
      await expectGoodLayout(page, testInfo);
    });
  });
}
