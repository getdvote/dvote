import { expect, test, type Page, type Route } from '@playwright/test';
import { DASHBOARD } from '../playwright.config';
import { expectGoodLayout } from '../lib/audit';
import { branches, staffMe } from '../lib/fixtures';
import { mockApi, setLanguage, signIn } from '../lib/mock-api';
import { KEY_VIEWPORTS } from '../lib/viewports';

const SESSION = `dvs_${'a'.repeat(64)}`;
const SECRET = 'b'.repeat(32);
const STORE = 'dvote-scanner-session';
const API = 'http://api.mock';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });

const view = (over: object = {}) => ({
  id: 'p1',
  state: 'active',
  pauseReason: null,
  deviceLabel: 'iPhone',
  branchId: branches[0].id,
  branchName: branches[0].name,
  staffName: 'Mona',
  claimedAt: new Date().toISOString(),
  sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  lastUsedAt: null,
  ...over,
});

const created = { id: 'p1', secret: SECRET, code: '427910', branchName: branches[0].name, expiresAt: new Date(Date.now() + 300_000).toISOString(), expiresInSeconds: 300 };

/** Later routes win in Playwright, so these sit on top of the shared mock. */
async function mockPairing(page: Page, rows: () => object[], onDelete?: () => void) {
  await page.route(`${API}/api/vendor/scanner-pairings`, (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (method === 'POST') return json(route, 201, created);
    return json(route, 200, rows());
  });
  await page.route(`${API}/api/vendor/scanner-pairings/*`, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    onDelete?.();
    return route.fulfill({ status: 204, headers: CORS });
  });
}

async function openScan(page: Page, role: 'vendor_admin' | 'staff' = 'vendor_admin') {
  await mockApi(page, role);
  await signIn(page);
  await page.addInitScript((id) => localStorage.setItem('dvote-till-branch', id), branches[0].id);
}

test.describe('Scan page: pair a phone', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('dialog shows the QR, code, branch and countdown', async ({ page }) => {
    await openScan(page);
    await mockPairing(page, () => []);
    await page.goto(`${DASHBOARD}/scan`);
    await page.getByRole('button', { name: 'Pair a phone' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('pair-code')).toHaveText('427 910');
    await expect(dialog).toContainText(branches[0].name);
    await expect(dialog.getByTestId('pair-countdown')).toContainText(/[0-5]:\d\d/);
    await expect(dialog.locator('svg[role="img"], svg').first()).toBeVisible();
    const value = await dialog.getByTestId('pair-qr').getAttribute('data-value');
    expect(value).toBe(`${DASHBOARD}/pair#${SECRET}`);
    expect(value).not.toContain('427910');
  });

  test('dialog offers a new code when it runs out', async ({ page }) => {
    await openScan(page);
    await mockPairing(page, () => []);
    await page.clock.install();
    await page.goto(`${DASHBOARD}/scan`);
    await page.getByRole('button', { name: 'Pair a phone' }).click();
    await expect(page.getByTestId('pair-code')).toBeVisible();
    await page.clock.fastForward(301_000);
    await expect(page.getByRole('button', { name: 'Get a new code' })).toBeVisible();
    await expect(page.getByTestId('pair-code')).toHaveCount(0);
  });

  test('dialog offers a new code once the code is cancelled by wrong tries', async ({ page }) => {
    await openScan(page);
    let rows: object[] = [view({ state: 'pending', claimedAt: null, sessionExpiresAt: null, deviceLabel: null })];
    await mockPairing(page, () => rows);
    await page.goto(`${DASHBOARD}/scan`);
    await page.getByRole('button', { name: 'Pair a phone' }).click();
    await expect(page.getByTestId('pair-code')).toBeVisible();
    await expect.poll(async () => page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.endsWith('/scanner-pairings')).length)).toBeGreaterThan(1);
    rows = [];
    await expect(page.getByRole('button', { name: 'Get a new code' })).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('pair-code')).toHaveCount(0);
  });

  test('dialog says connected once the phone pairs', async ({ page }) => {
    await openScan(page);
    let rows: object[] = [view({ state: 'pending', claimedAt: null, sessionExpiresAt: null, deviceLabel: null })];
    await mockPairing(page, () => rows);
    await page.goto(`${DASHBOARD}/scan`);
    await page.getByRole('button', { name: 'Pair a phone' }).click();
    await expect(page.getByTestId('pair-code')).toBeVisible();
    rows = [view()];
    await expect(page.getByRole('dialog')).toContainText('Phone connected', { timeout: 8000 });
  });

  test('paired phones list disconnects a phone', async ({ page }) => {
    await openScan(page);
    let rows: object[] = [view()];
    await mockPairing(page, () => rows, () => { rows = []; });
    await page.goto(`${DASHBOARD}/scan`);
    const list = page.getByTestId('paired-phones');
    await expect(list).toContainText('iPhone');
    await expect(list).toContainText('Mona');
    await list.getByRole('button', { name: 'Disconnect' }).click();
    await expect(page.getByTestId('paired-phones')).toHaveCount(0);
  });

  test('paused phone shows a blocked state', async ({ page }) => {
    await openScan(page);
    await mockPairing(page, () => [view({ state: 'paused', pauseReason: 'branch_closed' })]);
    await page.goto(`${DASHBOARD}/scan`);
    await expect(page.getByTestId('paired-phones')).toContainText('Paused');
    await expect(page.getByTestId('paired-phones')).toContainText('branch is closed');
  });

  test('Pair a phone is disabled until a branch is picked', async ({ page }) => {
    await mockApi(page, 'vendor_admin');
    await signIn(page);
    await mockPairing(page, () => []);
    await page.goto(`${DASHBOARD}/scan`);
    await expect(page.getByRole('button', { name: 'Pair a phone' })).toBeDisabled();
  });
});

test.describe('Scan page pairing layout', () => {
  for (const vp of KEY_VIEWPORTS) {
    test.describe(vp.name, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });
      for (const lang of ['en', 'ar'] as const) {
        test(`dialog fits · ${lang}`, async ({ page }, testInfo) => {
          await openScan(page);
          await setLanguage(page, lang);
          await mockPairing(page, () => [view({ id: 'other-phone' })]);
          await page.goto(`${DASHBOARD}/scan`);
          await page.getByTestId('pair-open').click();
          await expect(page.getByTestId('pair-code')).toBeVisible();
          await expectGoodLayout(page, testInfo);
        });
      }
    });
  }
});

/** The phone: the shared mock, with a signed-in dashboard session optional. */
async function mockPhone(page: Page, opts: { me?: (route: Route) => unknown; claim?: (body: { code: string }) => [number, object] } = {}) {
  const seen: string[] = [];
  await mockApi(page, 'staff');
  const me = { ...staffMe('staff'), branch: { id: branches[0].id, name: branches[0].name }, branches: [{ id: branches[0].id, name: branches[0].name }] };
  await page.route(`${API}/api/public/scanner-pairings/claim`, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const body = route.request().postDataJSON() as { code: string };
    const [status, answer] = opts.claim?.(body) ?? (body.code === '427910' ? [200, { sessionToken: SESSION, expiresAt: new Date(Date.now() + 3_600_000).toISOString() }] : [400, { code: 'pairing_invalid', message: 'x' }]);
    return json(route, status, answer);
  });
  await page.route(`${API}/api/vendor/scanner/me`, (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    seen.push(route.request().headers().authorization ?? '');
    if (method === 'DELETE') return route.fulfill({ status: 204, headers: CORS });
    if (opts.me) return opts.me(route) as never;
    return json(route, 200, me);
  });
  await page.route(`${API}/api/vendor/scans/**`, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    seen.push(route.request().headers().authorization ?? '');
    if (route.request().url().endsWith('/today')) return json(route, 200, { collects: 3, redemptions: 1 });
    return json(route, 404, { code: 'qr_invalid', message: 'x' });
  });
  return { seen, me };
}
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), STORE);
const enterCode = async (page: Page, code: string) => {
  await page.getByLabel('6-digit code').fill(code);
};
const startWithToken = (page: Page) => page.addInitScript(([k, v]) => localStorage.setItem(k, v), [STORE, SESSION]);

test.describe('Phone scanner page', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('pairs with the code and opens the scanner', async ({ page }) => {
    await mockPhone(page);
    await page.goto(`${DASHBOARD}/pair#${SECRET}`);
    await enterCode(page, '427910');
    await expect(page.getByRole('button', { name: /^Scan card/ })).toBeVisible();
    expect(await stored(page)).toBe(SESSION);
  });

  test('removes the secret from the address bar', async ({ page }) => {
    await mockPhone(page);
    await page.goto(`${DASHBOARD}/pair#${SECRET}`);
    await expect(page.getByLabel('6-digit code')).toBeVisible();
    expect(new URL(page.url()).hash).toBe('');
  });

  test('keeps the pairing when the phone page reloads before the code is typed', async ({ page }) => {
    await mockPhone(page);
    await page.goto(`${DASHBOARD}/pair#${SECRET}`);
    await expect(page.getByLabel('6-digit code')).toBeVisible();
    await page.reload();
    await enterCode(page, '427910');
    await expect(page.getByRole('button', { name: /^Scan card/ })).toBeVisible();
  });

  test('shows no shop name before the code is accepted', async ({ page }) => {
    const { me } = await mockPhone(page);
    await page.goto(`${DASHBOARD}/pair#${SECRET}`);
    await expect(page.getByLabel('6-digit code')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(me.vendor.name);
  });

  for (const [typed, label] of [['٤٢٧٩١٠', 'Arabic digits'], ['427 910', 'pasted spaces']] as const) {
    test(`accepts ${label}`, async ({ page }) => {
      const codes: string[] = [];
      await mockPhone(page, { claim: (b) => { codes.push(b.code); return [200, { sessionToken: SESSION, expiresAt: new Date(Date.now() + 3_600_000).toISOString() }]; } });
      await page.goto(`${DASHBOARD}/pair#${SECRET}`);
      await enterCode(page, typed);
      await expect(page.getByRole('button', { name: /^Scan card/ })).toBeVisible();
      expect(codes).toEqual(['427910']);
    });
  }

  test('wrong code shows one message and stays on the form', async ({ page }) => {
    await mockPhone(page);
    await page.goto(`${DASHBOARD}/pair#${SECRET}`);
    await enterCode(page, '111111');
    await expect(page.getByRole('alert')).toContainText('code');
    await expect(page.getByLabel('6-digit code')).toBeVisible();
    expect(await stored(page)).toBeNull();
  });

  test('submits by itself once all 6 digits are in, once', async ({ page }) => {
    const codes: string[] = [];
    await mockPhone(page, { claim: (b) => { codes.push(b.code); return [200, { sessionToken: SESSION, expiresAt: new Date(Date.now() + 3_600_000).toISOString() }]; } });
    await page.goto(`${DASHBOARD}/pair#${SECRET}`);
    await page.getByLabel('6-digit code').pressSequentially('427910');
    await expect(page.getByRole('button', { name: /^Scan card/ })).toBeVisible();
    expect(codes).toEqual(['427910']);
  });

  test('waits until all 6 digits are in', async ({ page }) => {
    const codes: string[] = [];
    await mockPhone(page, { claim: (b) => { codes.push(b.code); return [400, { code: 'pairing_invalid', message: 'x' }]; } });
    await page.goto(`${DASHBOARD}/pair#${SECRET}`);
    await page.getByLabel('6-digit code').pressSequentially('42791');
    await page.waitForTimeout(300);
    expect(codes).toEqual([]);
  });

  test('a wrong code clears the field and tries only once', async ({ page }) => {
    const codes: string[] = [];
    await mockPhone(page, { claim: (b) => { codes.push(b.code); return [400, { code: 'pairing_invalid', message: 'x' }]; } });
    await page.goto(`${DASHBOARD}/pair#${SECRET}`);
    await page.getByLabel('6-digit code').pressSequentially('111111');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByLabel('6-digit code')).toHaveValue('');
    await expect(page.getByLabel('6-digit code')).toBeEnabled();
    expect(codes).toEqual(['111111']);
    await page.getByLabel('6-digit code').pressSequentially('427910');
    await expect.poll(() => codes.length).toBe(2);
  });

  test('a lost connection keeps the code so Connect can retry', async ({ page }) => {
    await mockPhone(page);
    await page.route(`${API}/api/public/scanner-pairings/claim`, (route) => route.abort(), { times: 1 });
    await page.goto(`${DASHBOARD}/pair#${SECRET}`);
    await page.getByLabel('6-digit code').fill('427910');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByLabel('6-digit code')).toHaveValue('427910');
    await page.getByRole('button', { name: 'Connect' }).click();
    await expect(page.getByRole('button', { name: /^Scan card/ })).toBeVisible();
  });

  test('Disconnect on the laptop ends the phone within seconds, with no tap', async ({ page }) => {
    let disconnected = false;
    const base = { ...staffMe('staff'), branch: { id: branches[0].id, name: branches[0].name }, branches: [{ id: branches[0].id, name: branches[0].name }] };
    await mockPhone(page, { me: (route) => (disconnected ? json(route as Route, 401, { code: 'scanner_session_ended', reason: 'disconnected' }) : json(route as Route, 200, base)) });
    await startWithToken(page);
    await page.goto(`${DASHBOARD}/pair`);
    await expect(page.getByRole('button', { name: /^Scan card/ })).toBeVisible();
    disconnected = true;
    await expect(page.locator('body')).toContainText('disconnected from the Scan page', { timeout: 7000 });
    await expect.poll(() => stored(page)).toBeNull();
  });

  test('uses the session token, not a dashboard session', async ({ page }) => {
    const { seen } = await mockPhone(page);
    await signIn(page);
    await startWithToken(page);
    await page.goto(`${DASHBOARD}/pair`);
    await expect(page.getByRole('button', { name: /^Scan card/ })).toBeVisible();
    await expect.poll(() => seen.length).toBeGreaterThan(1);
    for (const auth of seen) expect(auth).toBe(`Bearer ${SESSION}`);
  });

  test('resumes after a reload with no code', async ({ page }) => {
    await mockPhone(page);
    await startWithToken(page);
    await page.goto(`${DASHBOARD}/pair`);
    await expect(page.getByRole('button', { name: /^Scan card/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: /^Scan card/ })).toBeVisible();
  });

  test('network loss keeps the session', async ({ page }) => {
    await mockPhone(page, { me: (route) => route.abort() });
    await startWithToken(page);
    await page.goto(`${DASHBOARD}/pair`);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    expect(await stored(page)).toBe(SESSION);
  });

  test('ended session clears the token and asks to pair again', async ({ page }) => {
    await mockPhone(page, { me: (route) => json(route as Route, 401, { code: 'scanner_session_ended', reason: 'disconnected' }) });
    await startWithToken(page);
    await page.goto(`${DASHBOARD}/pair`);
    await expect(page.locator('body')).toContainText('disconnected from the Scan page');
    await expect(page.locator('body')).toContainText('Pair');
    await expect.poll(() => stored(page)).toBeNull();
  });

  test('paused session shows why, then resumes', async ({ page }) => {
    let closed = true;
    const base = { ...staffMe('staff'), branch: { id: branches[0].id, name: branches[0].name }, branches: [{ id: branches[0].id, name: branches[0].name }] };
    await mockPhone(page, { me: (route) => (closed ? json(route as Route, 403, { code: 'branch_closed' }) : json(route as Route, 200, base)) });
    await startWithToken(page);
    await page.goto(`${DASHBOARD}/pair`);
    await expect(page.locator('body')).toContainText('branch is closed');
    expect(await stored(page)).toBe(SESSION);
    closed = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('button', { name: /^Scan card/ })).toBeVisible();
  });

  test('End session clears the token and calls the API', async ({ page }) => {
    await mockPhone(page);
    let deleted = false;
    page.on('request', (r) => { if (r.method() === 'DELETE' && r.url().endsWith('/scanner/me')) deleted = true; });
    await startWithToken(page);
    await page.goto(`${DASHBOARD}/pair`);
    await page.getByRole('button', { name: 'End session' }).click();
    await expect.poll(() => stored(page)).toBeNull();
    expect(deleted).toBe(true);
  });

  test('hides the Activity link and the pairing control', async ({ page }) => {
    await mockPhone(page);
    await startWithToken(page);
    await page.goto(`${DASHBOARD}/pair`);
    await expect(page.getByRole('button', { name: /^Scan card/ })).toBeVisible();
    await expect(page.locator('a[href*="/activity"]')).toHaveCount(0);
    await expect(page.getByTestId('pair-open')).toHaveCount(0);
  });

  test('a paired phone that rescans an old QR can go back to scanning', async ({ page }) => {
    await mockPhone(page);
    await startWithToken(page);
    await page.goto(`${DASHBOARD}/pair#${SECRET}`);
    await enterCode(page, '111111');
    await expect(page.getByRole('alert')).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Back to scanner' }).click();
    await expect(page.getByRole('button', { name: /^Scan card/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: /^Scan card/ })).toBeVisible();
    expect(await stored(page)).toBe(SESSION);
  });

  test('a new phone has no way back to a scanner it never had', async ({ page }) => {
    await mockPhone(page);
    await page.goto(`${DASHBOARD}/pair#${SECRET}`);
    await expect(page.getByLabel('6-digit code')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to scanner' })).toHaveCount(0);
  });

  test('opens the camera first when scanning', async ({ page }) => {
    await mockPhone(page);
    await startWithToken(page);
    await page.goto(`${DASHBOARD}/pair`);
    await page.getByRole('button', { name: /^Scan card/ }).click();
    await expect(page.getByRole('radio', { name: 'Camera' })).toBeChecked();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Scan card/ }).click();
    await expect(page.getByRole('radio', { name: 'Camera' })).toBeChecked();
  });

  test('the dashboard Scan page still starts on the hand scanner', async ({ page }) => {
    await openScan(page);
    await page.goto(`${DASHBOARD}/scan`);
    await page.getByRole('button', { name: /^Scan card/ }).click();
    await expect(page.getByRole('radio', { name: 'Camera' })).not.toBeChecked();
  });

  test('tells someone with no QR or session what to do', async ({ page }) => {
    await mockPhone(page);
    await page.goto(`${DASHBOARD}/pair`);
    await expect(page.locator('body')).toContainText('Scan page');
  });
});

test.describe('Phone scanner page layout', () => {
  for (const vp of KEY_VIEWPORTS) {
    test.describe(vp.name, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });
      for (const lang of ['en', 'ar'] as const) {
        test(`code form fits · ${lang}`, async ({ page }, testInfo) => {
          await mockPhone(page);
          await setLanguage(page, lang);
          await page.goto(`${DASHBOARD}/pair#${SECRET}`);
          await expectGoodLayout(page, testInfo);
        });
        test(`scanner fits · ${lang}`, async ({ page }, testInfo) => {
          await mockPhone(page);
          await setLanguage(page, lang);
          await startWithToken(page);
          await page.goto(`${DASHBOARD}/pair`);
          await expectGoodLayout(page, testInfo);
        });
      }
    });
  }
});
