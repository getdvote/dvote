# Deploying dvote (launch day)

Follow top to bottom. Everything in `<angle brackets>` is yours to fill. Never paste secrets into chat, git or screenshots.

## What runs where

| Part | Code | Host | Address | Cost |
|---|---|---|---|---|
| Customer website | `apps/web` | Cloudflare Pages | `https://dvote.co` | free |
| Dashboard (admin, merchants, staff **Scan** page) | `apps/dashboard` | Cloudflare Pages | `https://admin.dvote.co` | free |
| API | `apps/api` (Dockerfile) | Railway (or Google Cloud Run) | `https://api.dvote.co` | ~$5–10 / month |
| Database, sign-in, images | — | Supabase **Pro** | — | $25 / month |
| Domain, HTTPS, protection | — | Cloudflare | — | domain ~$15–20 / year |
| Emails (invites, resets) | — | Resend (SMTP) | `no-reply@dvote.co` | free ≤ 3,000 / month |

Staff use the dashboard's **Scan** page in the phone browser (sign in as Staff, allow the camera, "Add to Home screen"): no staff app release needed.

---

## 1. Domain + Cloudflare
1. Buy `dvote.co` (Cloudflare Registrar is cheapest for `.app`). If bought elsewhere, add the site to Cloudflare and switch the nameservers.
2. Cloudflare → **SSL/TLS → Overview**: **Full (strict)**. **Edge Certificates**: Always Use HTTPS on.
3. DNS records are created in the steps below (Pages and Railway give you the targets).

## 2. Supabase (production)
Decide: **new production project** (recommended; testing never touches real customers) or the current one after a clean-up.

**A. New project** (region **eu-west-1**, same as now):
1. Upgrade to **Pro**.
2. From your PC, with `DATABASE_URL` in `apps/api/.env` pointed **temporarily** at the new project:
   ```bash
   npx --prefix apps/api prisma migrate deploy --config apps/api/prisma7.config.ts
   ```
   (run it from `apps/api` if paths complain: `cd apps/api && npx prisma migrate deploy --config prisma7.config.ts`)
3. Supabase → SQL Editor → run `database/supabase_lockdown.sql` (whole file).
4. Storage buckets: `cd apps/api && npm run storage:setup`.
5. Platform admin: `cd apps/api && npm run admin:create -- --name "dvote" --email getdvote@gmail.com --password "<strong password>"`
6. Put `apps/api/.env` back to the development project afterwards.

**B. Keep the current project:** upgrade to **Pro**, run `database/reset_all_data.sql` (read its header), empty Storage buckets `vendors` and `avatars`, then step A.5.

**Both:** Authentication →
- **URL Configuration**: Site URL `https://admin.dvote.co`; Redirect URLs add `https://admin.dvote.co/**` (keep `http://localhost:5173/**` only on the dev project).
- **Emails → SMTP**: Resend (step 6). **Templates**: paste `docs/email-templates/*` (see its README).
- **Providers**: Email on, "Confirm email" on; Facebook off; Google as needed (not used by any app today).

## 3. API on Railway
1. railway.app → New project → **Deploy from GitHub repo** → `getdvote/dvote`.
2. Service **Settings**: **Root directory** `apps/api` (Railway finds the `Dockerfile`). Region: **Europe West** (near Supabase eu-west-1).
3. **Variables**: paste every line of `apps/api/.env.production.example`, filled in. Notes:
   - `GOOGLE_WALLET_KEY_JSON` = the whole service-account JSON on one line.
   - `WALLET_TOKEN_SECRET` = keep the same value forever once real cards exist.
   - `CORS_ORIGINS=https://dvote.co,https://admin.dvote.co`, `TRUST_PROXY=2`, `ADMIN_MFA_REQUIRED=true`.
4. Deploy. Check the logs end with `Nest application successfully started`.
5. **Settings → Networking → Custom domain**: `api.dvote.co` → Railway shows a CNAME target → in Cloudflare DNS add **CNAME `api` → that target**, **Proxied** (orange cloud).
6. Test: `https://api.dvote.co/api/health` → `{"status":"ok"…}`.
7. Keep **one** instance (no autoscaling to 2+): live updates, rate limits and background jobs run in memory.

(Cloud Run instead: build the same Dockerfile, `--min-instances=1 --max-instances=1`, CPU always allocated, region `europe-west1`, same variables.)

## 4. Customer website on Cloudflare Pages
1. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git** → `getdvote/dvote`.
2. Build settings:
   - Production branch: `main` (or the branch you release from)
   - Root directory: `apps/web`
   - Build command: `npm ci && npm run build`
   - Output directory: `dist`
   - Environment variables: `VITE_API_URL=https://api.dvote.co`, `NODE_VERSION=24`
3. Deploy → **Custom domains** → `dvote.co` (and `www.dvote.co` if you want it).
4. No redirect file needed: without a `404.html`, Pages serves `index.html` for every path (`/joy-corner/join` works).

## 5. Dashboard on Cloudflare Pages
Same as step 4 with:
- Root directory `apps/dashboard`
- Variables: `VITE_API_URL=https://api.dvote.co`, `VITE_WEB_URL=https://dvote.co`, `VITE_SUPABASE_URL=https://<project-ref>.supabase.co`, `VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>` (public), `NODE_VERSION=24`
- Custom domain `admin.dvote.co`

## 6. Emails from your domain (Resend)
1. resend.com → Domains → add `dvote.co` → add the shown DNS records (SPF, DKIM, DMARC) in Cloudflare (**DNS only**, grey cloud) → wait for **Verified**.
2. API Keys → create one (sending only).
3. Supabase → Authentication → Emails → **SMTP**: host `smtp.resend.com`, port `465`, user `resend`, password = the API key, sender `no-reply@dvote.co`, name `dvote`. Save.
4. Authentication → **Rate limits**: emails per hour ~100.
5. Test: invite yourself; use "Forgot password?" on the dashboard.

## 7. Google Wallet
1. Pay & Wallet Console → Google Wallet API → **Request publishing access** (website `https://dvote.co`, privacy `https://dvote.co/privacy`, screenshots of a pass).
2. Until approved, only listed test users can save passes. After approval nothing changes in code.
3. Add a default logo for merchants without one: square PNG at `apps/web/public/wallet/default-logo.png` (or change `WALLET_DEFAULT_LOGO_URL`).

## 8. Cloudflare protection
- **Security → WAF → Rate limiting rule**: path `/api/public/*`, e.g. 60 requests / minute per IP → block 10 min.
- **Turnstile** captcha on the join form: not built yet (ask to add before heavy promotion).
- Keep the API record **Proxied** so `TRUST_PROXY` sees the real client IP.

## 9. Go-live checks (in this order)
1. `https://api.dvote.co/api/health` → ok.
2. `https://admin.dvote.co` → sign in as `getdvote@gmail.com` → authenticator code.
3. Create the first merchant, its merchant admin (invite email arrives, not spam), rules, rewards (photo + Arabic), branches with map pins, staff.
4. Phone: `https://dvote.co/<shop>` → join → **Add to Google Wallet** → save.
5. Staff phone: dashboard **Scan** → scan the pass → collect → points update on the pass within a minute → redeem.
6. Admin → **System** page: all green.
7. Print each branch's QR poster and write the NFC tags: `https://dvote.co/<shop>?b=<branch-id>`.

## 10. After launch
- Supabase Pro: check daily backups are on; consider Point-in-Time Recovery when there are many customers.
- Uptime monitor (e.g. UptimeRobot, free) on `https://api.dvote.co/api/health` and `https://dvote.co`.
- Every new migration: apply to production (`prisma migrate deploy` with the production `DATABASE_URL`, from your PC), re-run `database/supabase_lockdown.sql` if it adds a table, then deploy the API.
- Railway and Pages redeploy automatically on every push to the production branch: merge to it only when tests pass.

## Rollback
- API: Railway → Deployments → previous one → **Redeploy**.
- Websites: Pages → Deployments → previous one → **Rollback**.
- Database: Supabase backups (Pro). Migrations are additive; never edit an applied one.
