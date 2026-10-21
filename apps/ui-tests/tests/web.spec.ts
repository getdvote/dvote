import { test } from '@playwright/test';
import { WEB } from '../playwright.config';
import { expectGoodLayout } from '../lib/audit';
import { publicCard } from '../lib/fixtures';
import { mockApi, setLanguage } from '../lib/mock-api';
import { KEY_VIEWPORTS, VIEWPORTS } from '../lib/viewports';

/** The customer website (dvote.app): mobile first, but must hold up on laptops too. */
const PAGES = [
  ['home', '/'],
  ['venue', '/joy-corner'],
  ['join', '/joy-corner/join'],
  ['rewards', '/joy-corner/rewards'],
  ['menu', '/joy-corner/menu'],
  ['branches', '/joy-corner/branches'],
  ['feedback', '/joy-corner/feedback'],
  ['card', `/c/${publicCard.publicId}`],
  ['privacy', '/privacy'],
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`web · ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    for (const [name, path] of PAGES) {
      test(name, async ({ page }, testInfo) => {
        await mockApi(page, 'vendor_admin');
        await page.goto(WEB + path);
        await expectGoodLayout(page, testInfo);
      });
    }
  });
}

for (const vp of KEY_VIEWPORTS) {
  test.describe(`web · arabic · ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    for (const [name, path] of PAGES) {
      test(name, async ({ page }, testInfo) => {
        await setLanguage(page, 'ar');
        await mockApi(page, 'vendor_admin');
        await page.goto(WEB + path);
        await expectGoodLayout(page, testInfo);
      });
    }
  });
}
