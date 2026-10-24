import { expect, test, type Page } from '@playwright/test';
import { DASHBOARD } from '../playwright.config';
import { expectGoodLayout } from '../lib/audit';
import { staffMe } from '../lib/fixtures';
import { mockApi, setLanguage, signIn } from '../lib/mock-api';
import { KEY_VIEWPORTS } from '../lib/viewports';

/** A merchant on Regular: locked features show "Available on Loyal" with the way to Billing. */
const REGULAR = {
  tier: 'regular',
  trial: false,
  features: {
    insights: false,
    branch_comparison: false,
    custom_segments: false,
    customer_export: false,
    nearby: false,
    card_design: false,
    brand_style: false,
    remove_branding: false,
  },
  limits: { activeRewards: 5, staffPerBranch: 3, menuImages: 3, broadcasts: { count: 2, windowHours: 168, perBranch: false } },
};

async function regularMe(page: Page) {
  const me = staffMe('vendor_admin');
  await page.route('http://api.mock/api/vendor/staff/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...me,
        vendor: {
          ...me.vendor,
          plan: { status: 'active', plan: 'regular', billingCycle: 'monthly', trialEndsAt: null, deleteAt: null, paidUntil: null, entitlements: REGULAR },
        },
      }),
    }),
  );
}

const PAGES = [
  ['insights', '/insights', 'Available on Loyal'],
  ['customers-segments', '/customers?view=segmentation', 'Available on Loyal'],
  ['customers-list', '/customers', null],
  ['card-design', '/card/design', 'Available on Loyal'],
  ['settings-branding', '/settings?tab=branding', 'Available on Loyal'],
  ['rewards', '/rewards', 'active rewards on Regular'],
  ['broadcast', '/broadcast', null],
] as const;

for (const lang of ['en', 'ar'] as const) {
  for (const vp of KEY_VIEWPORTS) {
    test.describe(`plan gating · regular · ${lang} · ${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });
      for (const [name, path, text] of PAGES) {
        test(name, async ({ page }, testInfo) => {
          await setLanguage(page, lang);
          await mockApi(page, 'vendor_admin');
          await regularMe(page);
          await signIn(page);
          await page.goto(DASHBOARD + path);
          if (lang === 'en' && text) await expect(page.getByText(text).first()).toBeVisible();
          if (lang === 'en' && text === 'Available on Loyal') {
            await expect(page.locator('a[href="/settings?tab=billing"]').first()).toBeVisible();
          }
          await expectGoodLayout(page, testInfo);
        });
      }
    });
  }
}
