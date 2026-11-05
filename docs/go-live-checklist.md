# Go-live checklist: dashboard, landing page, merchant scanner

Audited against `develop` at `8404bbd` on 2026-11-05. `DEPLOY.md` has the step-by-step setup; this file tracks what still blocks launch.

**How to read it**

- `[x]` confirmed in the code on the audit date.
- `[ ]` still to do, or not checkable from the code (hosting, dashboards, real devices).
- **Blocker** means do not launch without it. Everything else can follow soon after.

No test suite was run for this audit, and no live site, account or real phone was checked.

## Shared foundation (all three depend on this)

### Database and Supabase

- [ ] **Blocker:** restore the database connection. On 2026-11-05 the project address answered again, but the connection pooler still returned `tenant/user ... not found`. Compare `DATABASE_URL` in `apps/api/.env` with the Connect string in the Supabase dashboard.
- [ ] **Blocker:** create a separate production project. Development and production share `cfknsqlixyeihhkleock` today.
- [ ] **Blocker:** move production off the Free plan. It pauses after a week idle and has no automatic backups.
- [ ] **Blocker:** on the production project, run `prisma migrate deploy`, `database/supabase_lockdown.sql`, `storage:setup` and `admin:create` (`DEPLOY.md` step 5).
- [ ] **Blocker:** set Auth: Site URL, redirect URLs, Confirm email on, email templates pasted in.
- [ ] Run `npm run db:backup` once and restore it somewhere as a test. Check that `BACKUP_DIR` is valid on this Mac, because `DEPLOY.md` still shows a `G:/` path.

### API (`api.dvote.co`)

- [ ] **Blocker:** choose the host (Railway or Hetzner) and deploy one instance. Live updates, rate limits and background jobs are held in memory.
- [ ] **Blocker:** create the production variables list. `DEPLOY.md` points to `apps/api/.env.production.example`, which is not in the repo.
- [ ] **Blocker:** add `https://dvote.co` to the production `CORS_ORIGINS`. The list in `DEPLOY.md` leaves it out, and the landing page calls the API for plans and the Founding counter. Local `.env` has the same gap for `http://localhost:5175`.
- [ ] **Blocker:** set `TRUST_PROXY`, `ADMIN_MFA_REQUIRED=true`, `WALLET_TOKEN_SECRET` (never change it once cards exist) and `GOOGLE_WALLET_KEY_JSON`.
- [ ] **Blocker:** confirm `https://api.dvote.co/api/health` returns ok.
- [ ] Add the Cloudflare rate-limit rule on `api.dvote.co/api/public/*`.

### Release process

- [ ] **Blocker:** merge `develop` into `main`. `main` is the live branch and is 7 commits behind, without the landing redesign and billing work.
- [ ] Add CI. `.github` only contains `CODEOWNERS`, so nothing runs tests or builds automatically on a pull request.
- [ ] Run and pass: API tests and e2e tests, `apps/ui-tests`, and a production build of each app.
- [ ] Review the two local stashes before launch, then keep or delete them.

### Email and monitoring

- [ ] **Blocker:** verify `dvote.co` in Resend and connect Supabase SMTP (`DEPLOY.md` step 7). Test an invite and a password reset.
- [ ] Add uptime monitoring on the API health URL and `m.dvote.co`.
- [ ] Add error tracking. No Sentry or similar tool is installed in the API, dashboard, landing or staff apps.

### Customer side the launch relies on

- [ ] **Blocker:** move the storefront to `m.dvote.co`. Scanning has nothing to scan without customer cards.
- [ ] **Blocker:** get Google Wallet publishing approved. Until then only listed test users can save passes.
- [ ] Decide the launch position on iPhones. Apple Wallet is still pending and needs the Apple Developer Program.

## Merchant dashboard (`merchant.dvote.co`, `admin.dvote.co`)

### Done in code

- [x] Sign-up, trial, staff invites and role-based access.
- [x] Scan page at `/scan`. Plain staff accounts land there directly.
- [x] Scan page supports the device camera, hand scanners and typed codes.
- [x] Billing page and plan gating.
- [x] Team sign-in link with Copy in Settings → Team.

### To do

- [ ] **Blocker:** create the `dvote-dashboard` Worker, set its build variables and attach both domains (`DEPLOY.md` step 3).
- [ ] **Blocker:** set up Turnstile. Without the secret, the API refuses sign-ups in production.
- [ ] **Blocker:** confirm how merchants pay after the 14-day trial. Paymob is not built, so today they pay outside the product and an admin activates or renews the plan. Rehearse that flow once and write down who does it, or build Paymob first.
- [ ] **Blocker:** walk through it end to end: create a merchant, accept the invite, set up the card, rewards, branches and staff.
- [ ] Sign in to `admin.dvote.co` with an authenticator code. Confirm a merchant account is refused there.
- [ ] Check English and Arabic on desktop and phone for the main pages.
- [ ] Confirm admin **System** shows all green after deployment.

## Landing page (`dvote.co`)

### Done in code

- [x] One-page redesign in English and Egyptian Arabic.
- [x] Plans, pricing calculator, Founding counter and demo phone.
- [x] Meta description, WhatsApp and email contact links.
- [x] Privacy and terms links, which point to the storefront.

### To do

- [ ] **Blocker:** create the `dvote-landing` Worker with its build variables, including `VITE_API_URL`, which `DEPLOY.md` step 4 omits.
- [ ] **Blocker:** move `dvote.co` from `dvote-web` to `dvote-landing`, after the storefront is on `m.dvote.co`.
- [ ] **Blocker:** confirm plans and the Founding counter show real data, not a fallback, against the production API.
- [ ] **Blocker:** have the privacy policy and terms reviewed, and check every link in both languages.
- [ ] Turn on Always Use HTTPS in Cloudflare, and add the `dvote.co/m/*` redirect.
- [ ] Add Open Graph and social tags. `index.html` has none, so shared links show no preview.
- [ ] Add `robots.txt` and `sitemap.xml`. Neither exists.
- [ ] Add privacy-friendly analytics and track "Start free trial" clicks. None is installed.
- [ ] Check mobile layout, Lighthouse and the real WhatsApp number.

## Merchant scanner

**Launch with the dashboard Scan page and phone pairing (decided 2026-11-05).** It deploys with the dashboard and needs no installation. The Expo staff app is parked.

### Scan page: launch path

- [ ] **Blocker:** apply migration `34_scanner_pairings` and re-run `database/supabase_lockdown.sql` on every Supabase project before deploying the API that uses it.
- [ ] **Blocker:** pair and scan on real Android and iPhone browsers over HTTPS. Cameras only work on HTTPS or localhost.
- [ ] **Blocker:** test collect, redeem, wrong branch, expired QR, repeated scan and no internet.
- [ ] **Blocker:** confirm the Wallet pass updates after a collect and a redeem.
- [ ] Test one USB hand scanner on a laptop, including Arabic keyboard layout.
- [ ] Test in low light and with a cracked or dim customer screen.
- [x] **Pair a phone** on the Scan page: QR, 6-digit code, 12-hour session and Disconnect.
- [ ] Test how quickly the browser camera reads a QR in a dim café. If it's too slow, improve browser scanning before reconsidering the staff app.

### Staff app: parked, not at launch

The code stays in `apps/staff`. If merchants later ask for an installed app, it still needs a release setup (`eas.json`, `android.package`, `ios.bundleIdentifier`), Arabic and a way to distribute it.

## Launch day

- [ ] Take a backup before the release.
- [ ] Run `DEPLOY.md` step 10 in order, with one real merchant and one real phone.
- [ ] Print one test QR poster and write one NFC tag, then scan both in person.
- [ ] Write down who watches errors and support messages for the first week.
- [ ] Keep the rollback steps from `DEPLOY.md` open.
