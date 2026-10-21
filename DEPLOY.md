# Deploying dvote

Follow top to bottom. Everything in `<angle brackets>` is yours to fill. Never paste secrets into chat, git or screenshots.

## Addresses (decided 2026-10-21)

| Address | What | Code | Host | Status |
|---|---|---|---|---|
| `dvote.co` | **Landing page**: home, features, pricing, contact/FAQ; "Log in" → `merchant.dvote.co` | `apps/landing` | Cloudflare (Worker `dvote-landing`) | built 2026-10-21, not deployed: today `dvote.co` serves the customer website (temporary) |
| `www.dvote.co` | forwards to `dvote.co` | — | Cloudflare redirect rule | done |
| `merchant.dvote.co` | **Merchant dashboard**: merchant admins, managers, viewers, staff **Scan** page | `apps/dashboard` | Cloudflare (Worker `dvote-dashboard`) | to connect |
| `admin.dvote.co` | **Admin dashboard**: dvote team only (not linked from the public site) | `apps/dashboard` (same build) | same Worker | to connect |
| `m.dvote.co` | **Customer storefront**: what the QR / NFC at the till opens (`m.dvote.co/<shop>`), join, card page, wallet links, privacy, terms | `apps/web` | Cloudflare (Worker `dvote-web`) | built; domain to move here |
| `dvote.co/m/<shop>` | short form: forwards to `m.dvote.co/<shop>` | — | Cloudflare redirect rule | later, with the landing page |
| `api.dvote.co` | **API** | `apps/api` (Dockerfile) | Railway or Hetzner (to decide) | not deployed |
| Staff app | Android APK sent to merchants | `apps/staff` | — | — |

**Print `m.dvote.co/<shop>?b=<branch-id>` on QR posters and NFC tags** (the direct address; it keeps working whatever happens to the landing page).

**One dashboard build, two addresses.** `apps/dashboard` reads `VITE_ADMIN_URL` / `VITE_MERCHANT_URL`: on `admin.dvote.co` only platform admins get in, on `merchant.dvote.co` only merchant accounts; anyone else sees "this is the other dashboard" with a link and Sign out (`lib/config.ts` `site`, `router.tsx`, `WrongSitePage`). Each address keeps its own sign-in session (browsers separate them), so a sign-in is done on the dashboard's own address, never on the landing page. Locally both settings are empty: everyone can sign in, as before.

**Branches:** `develop` = integration (Cloudflare preview builds), **`main` = live** (every merge to `main` rebuilds the live sites). `main` is protected (pull request required).

| Part | Cost |
|---|---|
| Websites + dashboards (Cloudflare Workers static assets) | free |
| API on Railway (~$5–10 / month) or Hetzner VPS (~€4–5 / month) | to decide |
| Supabase | Free plan for now (no automatic backups: run `npm run db:backup`, see "Backups"); Pro $25 / month later |
| Domain `dvote.co` (Namecheap; DNS on Cloudflare) | ~yearly |
| Emails (Resend) | free ≤ 3,000 / month |

---

## 1. Domain + Cloudflare (done 2026-10-20)
- `dvote.co` registered at Namecheap; nameservers point to Cloudflare (`arch` / `desiree.ns.cloudflare.com`). Keep the MX records (Namecheap email forwarding).
- `www.dvote.co`: CNAME `www` → `dvote.co` (proxied) + redirect rule "WWW to root".
- To do: **SSL/TLS → Edge Certificates → Always Use HTTPS: on**.

## 2. Customer storefront → `m.dvote.co`
Already built and deployed (Cloudflare Workers & Pages, connected to GitHub `getdvote/dvote`):
- Build project settings: production branch `main`, root directory `apps/web`, build command `npm ci && npm run build`, deploy command `npx wrangler deploy`, build variable `VITE_API_URL=https://api.dvote.co`.
- `apps/web/wrangler.jsonc` publishes as the Worker **`dvote-web`** with single-page fallback (every path returns `index.html`).
- **When ready (not yet):** Worker `dvote-web` → Domains → remove `dvote.co`, **+ Add Domain** → subdomain `m` → `m.dvote.co`.

## 3. Dashboards → `merchant.dvote.co` + `admin.dvote.co`
1. Workers & Pages → **Create** → **Connect GitHub** → `getdvote/dvote`.
2. Settings: name `dvote-dashboard` (must match `apps/dashboard/wrangler.jsonc`), production branch `main`, root directory `apps/dashboard`, build command `npm ci && npm run build`, deploy command `npx wrangler deploy`.
3. **Build variables** (all public values):
   - `VITE_API_URL=https://api.dvote.co`
   - `VITE_WEB_URL=https://m.dvote.co`
   - `VITE_SUPABASE_URL=https://<project-ref>.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>` (never the secret key)
   - `VITE_MERCHANT_URL=https://merchant.dvote.co`
   - `VITE_ADMIN_URL=https://admin.dvote.co`
4. Deploy, then Worker **`dvote-dashboard`** → Domains → **+ Add Domain** → subdomain `merchant`, then again → subdomain `admin`.
5. Supabase → Authentication → **URL Configuration**: Site URL `https://merchant.dvote.co`; Redirect URLs add `https://merchant.dvote.co/**` and `https://admin.dvote.co/**`.

## 4. Landing page → `dvote.co`
Code in `apps/landing` (see its README). Workers & Pages → Create → Connect GitHub → name `dvote-landing`, production branch `main`, root `apps/landing`, build `npm ci && npm run build`, deploy `npx wrangler deploy`, build variables `VITE_MERCHANT_URL=https://merchant.dvote.co`, `VITE_STOREFRONT_URL=https://m.dvote.co`. Then move `dvote.co` from Worker `dvote-web` to `dvote-landing` (after step 2 put the storefront on `m.dvote.co`). Then two redirect rules: `dvote.co/m/*` → `https://m.dvote.co/${1}` (301). Until the landing page exists, `dvote.co` keeps whatever is attached (today the storefront); optionally forward `dvote.co` → `merchant.dvote.co` meanwhile.

## 4b. Self sign-up (free trial)
- **Captcha (Cloudflare Turnstile, free):** Cloudflare → **Turnstile** → **Add widget** → name `dvote sign-up`, hostnames `merchant.dvote.co` (and `localhost` for testing), mode **Managed** → copy the **site key** (public) into the dashboard build variable `VITE_TURNSTILE_SITE_KEY` and the **secret key** into the API variable `TURNSTILE_SECRET_KEY`. Without the secret the API refuses sign-ups in production (503). Local testing: Cloudflare's always-pass test keys (site `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`).
- Supabase → Authentication → Sign In / Providers → Email: **Allow new users to sign up: on**, **Confirm email: on**. Templates: paste `docs/email-templates/confirm-signup.html` into "Confirm signup".
- Dashboard build variable `VITE_LANDING_URL=https://dvote.co` (the pricing link on the trial screens).
- Migration `31_vendor_trial` on production before deploying the API.

## 5. Supabase (production)
Free plan for now on project `cfknsqlixyeihhkleock` (shared with development: be careful with test data and delete scripts). Recommended before real customers: a **second, separate free project** (or Pro) for production:
1. With `DATABASE_URL` in `apps/api/.env` pointed **temporarily** at it: `cd apps/api && npx prisma migrate deploy --config prisma7.config.ts`.
2. Supabase → SQL Editor → run `database/supabase_lockdown.sql`.
3. `cd apps/api && npm run storage:setup`.
4. `cd apps/api && npm run admin:create -- --name "dvote" --email getdvote@gmail.com --password "<strong password>"`.
5. Put `apps/api/.env` back to development.

Authentication (either project): Email on, "Confirm email" on, Facebook off (no app uses it); SMTP (step 7); templates from `docs/email-templates/` (see its README); URL Configuration (step 3.5).

## 6. API → `api.dvote.co` (host to decide)
**Railway:** New project → Deploy from GitHub repo `getdvote/dvote` → root directory `apps/api` (uses the `Dockerfile`) → region Europe West → Variables: every line of `apps/api/.env.production.example`, filled in → Settings → Networking → Custom domain `api.dvote.co` → in Cloudflare DNS add the CNAME it shows (**Proxied**). Keep **one** instance (live updates, rate limits and background jobs are in memory).
**Hetzner:** a small VPS running the same Docker image behind Caddy; ask for the server files before choosing it.
Production settings to remember: `CORS_ORIGINS=https://m.dvote.co,https://merchant.dvote.co,https://admin.dvote.co`, `PUBLIC_WEB_URL=https://m.dvote.co`, `STAFF_INVITE_REDIRECT_URL=https://merchant.dvote.co/set-password`, `TRUST_PROXY=2`, `ADMIN_MFA_REQUIRED=true`, `GOOGLE_WALLET_KEY_JSON` (whole key on one line), `WALLET_TOKEN_SECRET` (never change once cards exist).
Test: `https://api.dvote.co/api/health` → ok. Until the API is live, storefront shop pages show "Can't reach dvote right now" (expected).

## 7. Emails from your domain (Resend)
1. resend.com → Domains → add `dvote.co` → add its DNS records (SPF, DKIM, DMARC) in Cloudflare (**DNS only**) → wait for **Verified**.
2. Create an API key (sending only).
3. Supabase → Authentication → Emails → **SMTP**: host `smtp.resend.com`, port `465`, user `resend`, password = the API key, sender `no-reply@dvote.co`, name `dvote`.
4. Rate limits: ~100 emails / hour. Test an invite and "Forgot password?".

## 8. Google Wallet
1. Pay & Wallet Console → Google Wallet API → **Request publishing access** (website `https://dvote.co`, privacy `https://m.dvote.co/privacy`, screenshots of a pass).
2. Until approved only listed test users can save passes. No code change after approval.
3. Default logo for merchants without one: square PNG at `apps/web/public/wallet/default-logo.png` (`WALLET_DEFAULT_LOGO_URL`).

## 9. Cloudflare protection
- WAF rate limiting rule on `api.dvote.co/api/public/*` (e.g. 60 / minute per IP → block 10 min).
- Turnstile captcha on the join form: not built yet.
- Keep the API record **Proxied** so `TRUST_PROXY` sees the real client IP.

## 10. Go-live checks
1. `https://api.dvote.co/api/health` → ok.
2. `https://admin.dvote.co` → `getdvote@gmail.com` → authenticator code → admin pages. A merchant account there sees "this is the dvote admin dashboard".
3. Create the first merchant + its merchant admin (invite arrives; opens `merchant.dvote.co/set-password`).
4. `https://merchant.dvote.co` → merchant admin → set up card, rewards (photo + Arabic), branches with map pins, staff.
5. Phone: `https://m.dvote.co/<shop>` → join → **Add to Google Wallet**.
6. Staff phone: `merchant.dvote.co` → **Scan** → collect → the pass updates within a minute → redeem.
7. Admin → **System**: all green. Print QR posters / write NFC tags: `https://m.dvote.co/<shop>?b=<branch-id>`.

## Backups
`npm run db:backup` (repo root): database dump + every Storage image into `BACKUP_DIR` (`apps/api/.env`, today `G:/My Drive/dvote` = Google Drive for desktop). Images: only new files are copied. Run weekly and before any delete script (`database/delete_*.sql`, `reset_all_data.sql`).

## After launch / rollback
- Uptime monitor on `https://api.dvote.co/api/health` and `https://m.dvote.co`.
- New migration: apply to production from your PC (`prisma migrate deploy` with the production `DATABASE_URL`), re-run `supabase_lockdown.sql` if it adds a table, then deploy the API.
- Rollback: Cloudflare Worker → Deployments → previous → **Rollback**; Railway → Deployments → previous → **Redeploy**; database: a `db:backup` file or Supabase Pro backups.
