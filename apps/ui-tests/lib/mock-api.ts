import type { Page, Route } from '@playwright/test';
import * as f from './fixtures';

export type Role = 'admin' | 'vendor_admin' | 'branch_manager' | 'staff';

/** Endpoints the pages asked for that no mock answered: reported by the tests so mocks stay complete. */
export const unmocked = new Set<string>();

type Handler = (url: URL, method: string) => unknown;

/** [method, path pattern, handler]. First match wins. */
const routes: [string, RegExp, Handler][] = [
  // vendor (merchant) API
  ['GET', /^\/api\/vendor\/staff\/me$/, () => null], // filled per role below
  ['GET', /^\/api\/vendor\/billing$/, () => f.billing],
  ['GET', /^\/api\/admin\/settings\/founding$/, () => ({ total: 10, open: true, taken: 3, left: 7 })],
  ['GET', /^\/api\/vendor\/profile$/, () => f.vendor],
  ['GET', /^\/api\/vendor\/profile\/username$/, () => ({ available: true })],
  ['GET', /^\/api\/vendor\/summary$/, () => f.summary],
  ['GET', /^\/api\/vendor\/attention$/, () => f.attention],
  ['GET', /^\/api\/vendor\/go-live$/, () => f.goLive],
  ['GET', /^\/api\/vendor\/branches$/, () => f.branches],
  ['GET', /^\/api\/vendor\/point-rules$/, () => f.pointRules],
  ['GET', /^\/api\/vendor\/rewards$/, () => f.rewards],
  ['GET', /^\/api\/vendor\/rewards\/sold-out$/, () => f.soldOuts],
  ['GET', /^\/api\/vendor\/images$/, () => f.images],
  ['GET', /^\/api\/vendor\/staff$/, () => f.staff],
  ['GET', /^\/api\/vendor\/scans\/today$/, () => ({ collects: 128, redemptions: 14 })],
  ['GET', /^\/api\/vendor\/events$/, () => f.activity],
  ['GET', /^\/api\/vendor\/redemptions$/, () => f.redemptions],
  ['GET', /^\/api\/vendor\/insights$/, () => f.insights],
  ['GET', /^\/api\/vendor\/insights\/patterns$/, () => f.patterns],
  ['GET', /^\/api\/vendor\/reward-performance$/, () => f.rewardPerformance],
  ['GET', /^\/api\/vendor\/customers$/, () => f.customers],
  ['GET', /^\/api\/vendor\/customers\/[^/]+$/, () => f.customerDetail],
  ['GET', /^\/api\/vendor\/customer-feedback$/, () => f.customerFeedback],
  ['GET', /^\/api\/vendor\/storefront$/, () => f.storefront],
  ['GET', /^\/api\/vendor\/loyalty-card$/, () => f.loyaltyCard],
  ['GET', /^\/api\/vendor\/loyalty-card\/members$/, () => f.cardMembers],
  ['GET', /^\/api\/vendor\/broadcasts\/campaigns$/, () => []],
  ['GET', /^\/api\/vendor\/broadcasts\/quota$/, () => ({ used: 0, nearby: true, remaining: 2, resetsAt: null })],
  ['GET', /^\/api\/vendor\/broadcasts$/, () => f.broadcasts],
  ['GET', /^\/api\/vendor\/broadcasts\/nearby$/, () => ({ enabled: true, locations: 2 })],
  ['POST', /^\/api\/vendor\/broadcasts\/preview$/, () => ({ matched: 4200, linked: 3900, unavailable: 300, configured: true })],
  ['POST', /^\/api\/vendor\/customer-segments\/preview$/, () => ({ count: 412, customersTotal: 12_480 })],
  // admin API
  ['GET', /^\/api\/admin\/overview$/, () => f.overview],
  ['GET', /^\/api\/admin\/vendors$/, () => f.vendors],
  ['GET', /^\/api\/admin\/vendors\/[^/]+$/, () => f.vendor],
  ['GET', /^\/api\/admin\/vendors\/[^/]+\/branches$/, () => f.branches],
  ['GET', /^\/api\/admin\/vendors\/[^/]+\/point-rules$/, () => f.pointRules],
  ['GET', /^\/api\/admin\/vendors\/[^/]+\/rewards$/, () => f.rewards],
  ['GET', /^\/api\/admin\/vendors\/[^/]+\/images$/, () => f.images],
  ['GET', /^\/api\/admin\/vendors\/[^/]+\/staff$/, () => f.staff],
  ['GET', /^\/api\/admin\/users$/, () => f.users],
  ['GET', /^\/api\/admin\/users\/[^/]+$/, () => f.userDetail],
  ['GET', /^\/api\/admin\/users\/[^/]+\/events$/, () => ({ items: f.userDetail.events, total: 40, page: 1, pageSize: 10 })],
  ['GET', /^\/api\/admin\/stats\/qr-sources$/, () => f.qrSources],
  ['GET', /^\/api\/admin\/system\/database$/, () => f.systemDatabase],
  ['GET', /^\/api\/admin\/system\/status$/, () => f.systemStatus],
  ['GET', /^\/api\/admin\/fraud\/summary$/, () => f.fraudSummary],
  ['GET', /^\/api\/admin\/fraud\/flags$/, () => f.fraudFlags],
  ['GET', /^\/api\/admin\/merchant-feedback$/, () => f.merchantFeedback],
  // public API (customer website)
  ['GET', /^\/api\/public\/vendors\/[^/]+$/, () => f.publicVendor],
  ['GET', /^\/api\/public\/cards\/[^/]+$/, () => f.publicCard],
  ['GET', /^\/api\/public\/cards\/[^/]+\/wallet-status$/, () => ({ google: false, apple: false })],
];

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  });

/** Answers every call to the fake API and Supabase hosts. */
export async function mockApi(page: Page, role: Role) {
  await page.route('http://supabase.mock/**', (route) => json(route, 200, {}));
  await page.route('http://api.mock/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    if (url.pathname.startsWith('/api/admin/workspace/'))
      return json(route, 200, {
        items: [
          {
            id: f.VENDOR_ID,
            vendorId: f.VENDOR_ID,
            vendorName: f.vendor.name,
            name: 'Workspace record',
            detail: 'Merchant operations',
            status: 'active',
            points: 100,
            amount: null,
            createdAt: new Date().toISOString(),
          },
        ],
        total: 1,
      });
    const workspace = url.pathname.match(/^\/api\/admin\/vendors\/([^/]+)\/workspace\/(.*)$/);
    if (workspace) {
      url.pathname = '/api/vendor/' + workspace[2];
      if (workspace[2] === 'staff/me')
        return json(route, 200, {
          ...f.staffMe('vendor_admin'),
          id: f.adminMe.id,
          name: f.adminMe.name,
          vendorId: workspace[1],
        });
    }
    if (method === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': '*',
        },
      });
    }
    if (url.pathname === '/api/admin/me') {
      return role === 'admin'
        ? json(route, 200, f.adminMe)
        : json(route, 403, {
            code: 'not_admin',
            message: 'Not a platform admin',
          });
    }
    if (url.pathname === '/api/vendor/staff/me') {
      return role === 'admin' ? json(route, 403, { code: 'not_staff' }) : json(route, 200, f.staffMe(role));
    }
    const hit = routes.find(([m, re]) => m === method && re.test(url.pathname));
    if (hit) return json(route, 200, hit[2](url, method));
    if (method === 'GET') unmocked.add(`${method} ${url.pathname}`);
    return json(route, method === 'GET' ? 404 : 200, method === 'GET' ? { code: 'not_mocked' } : {});
  });
}

/** A stored Supabase session the dashboard trusts locally (it never leaves the browser: Supabase is mocked). */
export async function signIn(page: Page) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  const accessToken = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
    sub: 'mock-user',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'mock@dvote.test',
    exp,
    iat: exp - 3600,
    aal: 'aal1',
    amr: [{ method: 'password', timestamp: exp - 3600 }],
    session_id: 'mock-session',
  })}.mock-signature`;
  const session = {
    access_token: accessToken,
    refresh_token: 'mock-refresh',
    token_type: 'bearer',
    expires_in: 3600 * 24,
    expires_at: exp,
    user: {
      id: 'mock-user',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'mock@dvote.test',
      factors: [],
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
  await page.addInitScript((value) => { try { window.localStorage.setItem('dvote-dashboard-auth', value); } catch { /* Sandboxed storefront previews do not have storage access. */ } }, JSON.stringify(session));
}

/** Dashboard / website language, set before the first paint like a returning visitor. */
export async function setLanguage(page: Page, language: 'en' | 'ar') {
  await page.addInitScript((lang) => {
    window.localStorage.setItem('dvote-dashboard-language', lang);
    window.localStorage.setItem('dvote-web-language', lang);
  }, language);
}
