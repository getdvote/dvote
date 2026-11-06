import { expect, test, type Locator, type Page } from '@playwright/test';
import { DASHBOARD } from '../playwright.config';
import { branches } from '../lib/fixtures';
import { mockApi, setLanguage, signIn } from '../lib/mock-api';

/**
 * The points rule mixes numbers, a Latin currency code and (in Arabic) right-to-left words. Without
 * direction isolation the browser reorders it: "10 EGP = 1 نقطة" shows as "نقطة EGP = 1 10". The text
 * content stays right either way, so these checks measure where each piece lands on screen.
 */
const SIZES = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
] as const;

/** The horizontal centre of each token on screen. Tokens are looked up in reading order. */
function positions(line: Locator, tokens: string[]) {
  return line.evaluate((el, wanted) => {
    const node = el.firstChild as Text;
    const text = node.data;
    let from = 0;
    return wanted.map((token) => {
      const start = text.indexOf(token, from);
      if (start < 0) throw new Error(`"${token}" not found in "${text}"`);
      from = start + token.length;
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, from);
      const box = range.getBoundingClientRect();
      return box.left + box.width / 2;
    });
  }, tokens);
}

/** "10 EGP" always reads left to right. Everything after it runs the way the language runs. */
async function expectRuleOrder(line: Locator, language: 'en' | 'ar', rest: string[]) {
  await expect(line).toBeVisible();
  const [spend, ...others] = await positions(line, ['10', 'EGP', ...rest]);
  expect(spend, '"10" sits to the left of "EGP"').toBeLessThan(others[0]);
  const expected = [...others].sort((x, y) => (language === 'en' ? x - y : y - x));
  expect(others, `pieces run ${language === 'en' ? 'left to right' : 'right to left'} after the amount`).toEqual(expected);
}

async function open(page: Page, language: 'en' | 'ar', path: string) {
  await setLanguage(page, language);
  await mockApi(page, 'vendor_admin');
  await signIn(page);
  await page.addInitScript((id) => localStorage.setItem('dvote-till-branch', id), branches[0].id);
  await page.goto(DASHBOARD + path);
}

for (const size of SIZES) {
  for (const language of ['en', 'ar'] as const) {
    const en = language === 'en';

    test.describe(`points rule · ${language} · ${size.name}`, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      test('Scan page line and amount dialog', async ({ page }) => {
        await open(page, language, '/scan');
        const rest = ['=', '1', en ? 'points' : 'نقطة'];
        await expectRuleOrder(page.locator('p', { hasText: /EGP.*=/ }), language, rest);

        await page.route(/\/api\/vendor\/scans?\/preview/, (route) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: { 'access-control-allow-origin': '*' },
            body: JSON.stringify({ usable: true, purpose: 'collect', reason: null, redeem: null, wallet: null }),
          }),
        );
        await page.getByRole('button', { name: /^(Scan card|مسح البطاقة|سكان الكارت)/ }).click();
        await page.locator('#till-code').fill('dvote:c1:rule-test');
        await page.locator('#till-code').press('Enter');
        await expectRuleOrder(page.getByRole('dialog').locator('p', { hasText: /EGP.*=/ }), language, rest);
      });

      test('Insights rate under the points value', async ({ page }) => {
        await open(page, language, '/insights');
        const line = page.getByText(en ? /^At .*EGP/ : /^بمعدل .*EGP/);
        await expectRuleOrder(line, language, ['=', '1', en ? 'pts' : 'نقطة']);
      });
    });
  }
}
