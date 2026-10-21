import { test } from '@playwright/test';
import { DASHBOARD } from '../playwright.config';
import { expectGoodLayout } from '../lib/audit';
import { VENDOR_ID } from '../lib/fixtures';
import { mockApi, signIn } from '../lib/mock-api';
import { VIEWPORTS } from '../lib/viewports';

/** Platform admin pages (English only by design). */
const PAGES = [
  ['overview', '/'],
  ['merchants', '/merchants'],
  ['merchant-detail', `/merchants/${VENDOR_ID}`],
  ['customers', '/customers'],
  ['statistics', '/statistics'],
  ['feedback', '/feedback'],
  ['system', '/system'],
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`admin · ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    for (const [name, path] of PAGES) {
      test(name, async ({ page }, testInfo) => {
        await mockApi(page, 'admin');
        await signIn(page);
        await page.goto(DASHBOARD + path);
        await expectGoodLayout(page, testInfo);
      });
    }
  });
}

test.describe('sign-in page', () => {
  for (const vp of VIEWPORTS) {
    test(vp.name, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await mockApi(page, 'admin');
      await page.goto(DASHBOARD + '/');
      await expectGoodLayout(page, testInfo);
    });
  }
});
