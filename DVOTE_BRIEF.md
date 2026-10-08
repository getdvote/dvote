# dvote — Project Brief (handoff)

> **Read this first.** A self-contained summary of the dvote business, product, technical setup,
> current status and working agreements, written so a new Claude session (or person) can pick up
> the project cold. Last updated **2026-10-08**.
>
> - Technical rules for coding live in [`CLAUDE.md`](CLAUDE.md) (loaded automatically by Claude Code in this repo).
> - Full original spec: `docs/Coffee_Loyalty_Platform_Documentation.pdf` (v2.0; partly outdated, see §9).
> - Database source of truth: `database/dvote_schema.sql`.
> - Repo: `github.com/getdvote/dvote` — work happens on `develop`; merging needs Karim's approval.
> - **This file contains no secrets.** Keys and passwords live only in each app's `.env` (never committed).

---

## 1. What dvote is

**dvote is a loyalty platform for coffee shops in Egypt.** Customers collect points when they buy
and spend them on free items. One customer app works across every dvote coffee shop; each shop
keeps its own points and rewards.

- **For customers:** one app instead of a paper stamp card per shop. Show a QR at the counter, get points, see your balance per shop, redeem rewards.
- **For coffee shops (vendors):** a ready-made loyalty programme — their own earning rule, reward menu, staff accounts and (later) reports — without building an app.
- **For dvote (the platform):** onboard shops, support customers, fix point mistakes, watch for fraud. Vendor billing is planned for later (not v1).

### The core idea in one example

Joy Corner sets **"every 10 EGP = 1 point"** and a reward menu: **free coffee = 300 pts**, **free
cheesecake = 500 pts**, **coffee + cheesecake = 750 pts**.

1. A customer pays 95 EGP, opens the dvote app and shows their QR.
2. The cashier scans it with the dvote **staff app** and types **95**.
3. The server computes `floor(95 / 10) × 1 = 9` points (always **rounded down**) and adds them to the customer's **Joy Corner card**.
4. The customer's screen updates by itself: **"+9 points · Joy Corner · balance 129"**.
5. Later, with ≥ 300 points, the customer picks "free coffee", shows a **redeem QR**, the cashier confirms, and 300 points are deducted (leftover stays: 1000 − 300 = 700).

---

## 2. Who uses what (four clients, one backend)

| Client | Users | What they do | Status |
|---|---|---|---|
| **Customer app** (React Native/Expo, iOS + Android) | Customers | Sign in, see cards (points per shop), show collect QR, profile; later browse shops + redeem | **Mostly built** (`apps/mobile`) |
| **Staff app** (React Native/Expo, separate app; web + phones) | Cashiers, branch managers, vendor admins | Sign in, scan customer QR, enter bill amount, see points granted; later confirm redemptions | **Built for collect** (`apps/staff`) |
| **Vendor dashboard** (React web) | Vendor admins, branch managers | Branches, staff, point rule, rewards, reports | Not started |
| **Admin dashboard** (React web, same app as vendor dashboard, role-based) | dvote platform admins | All vendors, onboarding, support, point corrections, fraud review | Not started (admin **APIs** for vendors exist) |

All four talk to **one NestJS API**. The apps never touch the database directly.

---

## 3. Business rules (the invariants — don't break these)

1. **Points belong to a customer *per vendor*** (a "card"). Points earned at any branch of Joy Corner go on the Joy Corner card. **Points never move between vendors.**
2. **The server decides points, never the apps.** The customer app only shows a code; the staff app only sends the code and the bill amount.
3. **Points formula:** `floor(amount / spend_amount) × points_per_spend`, capped at `max_points_per_purchase`; 0 if below `min_purchase`. If the result is 0 → rejected (`no_points_earned`), nothing is written. Money is handled in integer piastres in code, `numeric(12,2)` in the DB — never floats.
4. **The ledger is the truth.** Every point change is an append-only `point_events` row (earn / redeem / admin adjust). `cards.balance` always equals the sum of that card's ledger, updated in the same DB transaction. Corrections are new "adjust" rows, never edits or deletes.
5. **A card is created on the customer's first purchase** at a vendor (no points → no card).
6. **The customer chooses when to redeem.** Leftover points stay.
7. **Versioning:** a new point rule is a new version that applies from then on (past earns keep their rule). Reward price/name edits apply to future redemptions; each redemption snapshots the name and cost. Archived rewards can't be redeemed.
8. **QR codes are one-time server secrets:** random 128-bit code (`dvote:q1:<code>`), only its SHA-256 stored, **valid 5 minutes, single use**. Opening a new QR cancels the customer's previous one. The customer's id is never inside the QR.
9. **The vendor and branch always come from the staff member who scans** — never from the customer's phone. (Decided 2026-10-08: there are **no shop-specific collect QRs**; one QR works at any dvote shop, so a customer can't pick the wrong shop.) Vendor admins (who have no branch) choose the branch when scanning.
10. **Tenant isolation:** a vendor's staff can only ever see/act on their own vendor's data (other vendors' rows look like "not found"). Vendors never see customer names, emails or phones — only counts.
11. **Never hard-delete business rows**; use a `status` (suspended / disabled / archived / blocked).

### Fraud flags (planned, scheduled job; they only flag, never block)
- `too_many_collects`: > 3 collects for one customer in one day at one vendor.
- `large_purchase`: bill ≫ branch's usual (e.g. > 5× 30-day average).
- `branch_spike`: branch daily points > 3× its 30-day average.
- `staff_spike`: one staff member's daily points > 3× their own average.

---

## 4. The flows

### Collect (earn) — **built end to end**
1. Customer taps the **QR button** (next to the profile) → app calls `POST /api/app/qr-codes {purpose:"collect"}` → shows the QR with a 5-minute countdown.
2. The app **polls every 2 s** (`GET /api/app/qr-codes/{id}`).
3. Staff app scans → `POST /api/vendor/scans/preview` (is it usable?) → staff type the bill → `POST /api/vendor/scans/collect {code, amount, receiptRef?, branchId?, idempotencyKey}`.
4. Server checks (in order): code valid / not used / not expired / not cancelled → idempotency (a retried request returns the original result, points added once) → purpose → branch → customer not blocked → active rule → points > 0 → receipt not reused. A failed check changes nothing.
5. One DB transaction: create card if needed → ledger row → balance += points → mark QR used (only if still active, so two simultaneous scans can't both succeed).
6. Staff app shows "+N points"; the customer's poll sees `used` and shows **"+N points, bill, new balance"** (with a vibration). Closing the QR screen cancels an unused QR.

> "Notification" today = this live screen update while the QR screen is open. **Push notifications** (when the app is closed) are on the "later" list (Firebase, free).

### Redeem — **not built yet** (next big feature)
Customer picks a reward → redeem QR tied to that reward's vendor → staff scan → preview "Redeem: free coffee · 300 pts" → confirm → one transaction: `UPDATE cards SET balance = balance - cost WHERE balance >= cost` (no row → `insufficient_points`) + ledger row + redemption snapshot + QR used. Here a vendor mismatch **is** an error (`vendor_mismatch`), because a reward belongs to one shop.

### Onboarding (who creates whom)
1. **Platform admin** (dvote team) — created only by a script: `npm run admin:create -- --name … --email … --password …`. Signs in with password + authenticator app (2FA).
2. Platform admin **creates a vendor** (`POST /api/admin/vendors`) and **invites its vendor admin** by email (`POST /api/admin/vendors/{id}/admins`).
3. **Vendor admin** invites branch managers and staff (`POST /api/vendor/staff`). Branch managers can manage staff in their own branch.
4. **Staff never sign themselves up.** Customers sign themselves up.

---

## 5. Sign-in (Supabase Auth)

- **Customers:** Google, Facebook, or email + password (email must be confirmed). No phone/SMS (costs money), no anonymous, **Apple postponed** ($99/yr developer account; iOS App Store will likely require it once Google/Facebook are offered).
- **Staff:** email + password via invite email (Google works too if the email matches).
- **Platform admins:** email + password + TOTP 2FA (required).
- Supabase issues all tokens; the API only verifies them (JWKS) and maps the Supabase user id to dvote rows. The API never issues tokens. There are no `/auth/*` endpoints.

**Current provider state (testing):**
- Google OAuth app is in **Testing** mode → only listed test users can sign in. To open to everyone: Google Cloud Console → Google Auth Platform → Audience → **Publish app** (free, no review for name/email).
- Facebook app is in **Development** mode → only app roles can sign in. To go **Live** it needs a public **privacy policy URL** and **data-deletion instructions URL** (no website yet), category and icon. No app review needed for email/public_profile.
- Email sign-up works for anyone, but Supabase's built-in email sender allows only a few emails/hour (`email_rate_limited`). Fix: custom SMTP (Gmail app password or Resend free) in Supabase → Authentication → Emails.

---

## 6. Technical architecture

| Part | Choice |
|---|---|
| Backend | **NestJS** (TypeScript), **Prisma 7** with the pg adapter, folder-per-feature |
| Database | **Supabase Postgres 17** (cloud, since 2026-10-08). Local PostgreSQL 18 is used **only for automated tests** |
| Auth | **Supabase Auth** (tokens verified by the API) |
| Mobile | **React Native + Expo SDK 57 + Expo Router**, TypeScript. Two apps: customer (`apps/mobile`) and staff (`apps/staff`) |
| Web dashboards (planned) | React + Vite + Ant Design + TanStack Query + Recharts, one app with vendor/admin routes |
| API contract (planned) | OpenAPI from NestJS → generated typed client `packages/api-client` (apps use hand-written types until then) |
| Hosting v1 (planned) | One API container + the managed database. No microservices, queues or Redis |

**Repo layout:** `apps/api` (NestJS) · `apps/staff` (staff app) · `apps/mobile` (customer app) · `apps/dashboard` + `packages/api-client` (placeholders) · `database/` (schema, seed, Supabase lockdown script) · `docs/` (spec PDF + its HTML source).

**Database (13 tables):** `vendors`, `branches`, `staff_users`, `point_rules`, `rewards`, `users` (customers; includes optional `gender`, `birth_date`), `user_identities` (unused), `cards`, `qr_codes`, `point_events` (ledger), `redemptions`, `platform_admins`, `fraud_flags`. Many rules are enforced by the database itself (constraints, composite foreign keys so points can't cross vendors, a trigger that blocks editing/deleting ledger rows). Migrations `0`–`5` are applied to both cloud and local.

**Security notes:**
- Supabase's automatic public table API is **locked** (`database/supabase_lockdown.sql`: row-level security on every table, no grants for the public roles). Re-run it after adding any table.
- The Supabase **secret key** lives only in `apps/api/.env`. Apps only get the **publishable** key.
- ⚠️ The Supabase secret key was once pasted in chat → **should be rotated** (Project Settings → API Keys).

---

## 7. What's built (as of 2026-10-08)

**API (`apps/api`)** — 111 end-to-end + 39 unit tests passing.
- Health check, Swagger at `/api/docs` (dev only).
- Customer: `GET|PATCH /api/app/users/me` (name, phone, gender, birthday), `GET /api/app/cards`, `GET /api/app/cards/{id}/events`, QR codes (create / poll / cancel).
- Staff: `GET /api/vendor/staff/me`, staff CRUD with role rules, `GET|PATCH /api/vendor/profile`, `POST /api/vendor/scans/preview`, `POST /api/vendor/scans/collect`.
- Admin: vendors CRUD + invite vendor admin (2FA required).

**Customer app (`apps/mobile`)** — welcome (Google / Facebook / email sign-up + log-in, forgot/reset password, email confirmation), Cards list + per-card history, "You" hub, Profile details (name, phone, gender switch, **birthday calendar** with validation), Settings, About, **collect QR screen** with live "+N points" update. Placeholders: Discover (needs vendors API), feedback / help / terms / join-as-vendor content, delete account.

**Staff app (`apps/staff`)** — log-in → home (vendor, logo, branch) → scan QR (camera) → enter bill (shows the rule) → "points granted" screen. Runs in the browser and on phones.

**Postman:** workspace "dvote", collection "dvote API", environment "dvote local". (The old "1b vendor QR" request is obsolete — collect QRs no longer take `vendorId`.)

---

## 8. What's next (roadmap)

**Build order (Karim decides what comes next — don't jump ahead):**
1. ✅ API scaffold · ✅ customer auth + profile · ✅ staff auth + staff CRUD · ✅ admin auth + vendors CRUD · ✅ QR + collect + cards
2. **Vendor setup APIs:** branches, point rules (versioned), rewards (archive, never delete).
3. **Redeem flow** (API + both apps).
4. Reports, remaining admin APIs (user support/block, point adjust, fraud review), fraud-flag job.
5. React vendor/admin dashboard.
6. Generated `packages/api-client` for all apps.

**Known gaps / open items for the customer app & launch:**
- `GET /api/app/vendors` + vendor page (for Discover); vendor `brand_color` (cards use a generated palette today).
- **Vendor logos:** plan = Supabase Storage public bucket `vendor-logos`, link saved in `vendors.logo_url`; later an upload endpoint in the admin dashboard.
- **Delete account:** needs a decision on what happens to points/cards (soft delete).
- Language & notification preferences (Settings shows "Soon").
- Content pages: feedback, help, terms, privacy policy, join as vendor.
- **Host the API online** so friends can test without Karim's PC (database is already in the cloud).
- Publish Google OAuth, take Facebook Live (needs privacy-policy + data-deletion pages), custom SMTP.
- Supabase **Free plan**: pauses after 1 week idle (click Restore), no backups → move to **Pro ($25/mo)** before real customers.
- Optional: minimum age for birthdays (none today).

**Later (not v1):** push notifications (FCM), point expiry, vendor-side void of a mistyped collect, promotions (double points), offline QR, POS integration, Apple sign-in, vendor billing.

---

## 9. Decisions log (most recent first)

| Date | Decision |
|---|---|
| 2026-10-08 | Birthday is picked from dvote's own calendar sheet (same on Android/iPhone/web), validated in app and API (real date, 1900 → today). |
| 2026-10-08 | `users.gender` (male/female, empty = not given) and `users.birth_date` (plain date) added (migration 5). |
| 2026-10-08 | **No shop-specific collect QRs**: vendor + branch always come from the scanning staff. |
| 2026-10-08 | Whole database moved to **Supabase cloud** (Free plan, eu-west-1, Session pooler connection). Local Postgres = tests only. |
| 2026-10-08 | Collect QR screen in the customer app polls every 2 s and shows "+N points" + balance. |
| 2026-10-07/08 | Customer app built as **iOS/Android** (Expo); a browser preview exists only for development. |
| 2026-10-03 | Customers can also sign up with **email + password**. |
| 2026-10-03 | **Business model v2:** spend-based points + reward catalogue + one-time QR codes + separate staff app. **NFC removed.** |
| 2026-10-03 | Platform admin creates vendors and vendor admins **through the API** (no script for vendor admins). Only platform admins are created by script. |
| 2026-09-30 | Sign-in via Supabase (auth only at the time); Google + Facebook; **Apple dropped for now** (paid). |
| 2026-09 | Mobile = **React Native** (not Flutter). |

**Spec PDF is outdated on:** `/me` routes (`/api/app/users/me`), admin 2FA auth, customer email sign-up, cloud database, no vendor QRs, gender/birthday. Trust `CLAUDE.md` + this brief over the PDF.

---

## 10. How to run it locally (Windows, from the repo root `D:\dvote_project\dvote`)

1. **API:** `npm run api:install` (first time) → `npm run api:dev` → http://localhost:3000/api/health and Swagger at http://localhost:3000/api/docs.
   - `apps/api/.env` needs: `DATABASE_URL` (Supabase Session pooler URL), `TEST_DATABASE_URL` (local Postgres, tests only), `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CORS_ORIGINS=http://localhost:8081,http://localhost:8082`, optionally `ADMIN_MFA_REQUIRED=false` (local only). See `apps/api/.env.example`.
   - Tests: `npm run api:test` and `npm run api:test:e2e` (e2e refuse to run against anything but the local database).
2. **Staff app:** `npm run staff:install` → `npm run staff:web` (browser, port 8081) or `npm run staff:start` (phone via Expo Go).
3. **Customer app:** `npm run mobile:install` → `npm run mobile:start` (port 8082; scan the QR with Expo Go, or press `a` for the Android emulator, or `w` for the browser preview). Add `:clear` (`npm run mobile:start:clear`) after dependency changes.
4. Each app's `.env` needs `EXPO_PUBLIC_API_URL=http://localhost:3000` (the app swaps localhost for the PC's address on a phone), `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable key only).
5. Supabase → Authentication → URL Configuration → Redirect URLs must include `exp://**`, `dvote://**` (and `http://localhost:8082/**` for browser sign-in with Google/Facebook).
6. **Android emulator:** Android Studio → Device Manager → ▶ "Medium Phone" (an AVD named `Medium_Phone_API_37.0` exists), then `npm run mobile:start` and press `a`.
7. If Windows **Smart App Control** is on, it blocks local PostgreSQL's `plpgsql.dll` (only matters for local tests now).

**Dev data:** seed vendor **Joy Corner** (`database/dvote_seed_joy_corner.sql`, ids `11111111-0000-…`), plus vendors costa and Ecuador Coffee created through the API.

---

## 11. Working agreements with Karim (how to collaborate)

- **Karim decides the feature order.** Build what's asked; suggest, but don't start the next feature unprompted.
- Explain things **step by step in plain language**; Karim tests in Postman, the staff app, the customer app and the Android emulator.
- **Don't create new dev HTML test pages** unless asked (test through e2e tests / Swagger / Postman).
- **Secrets:** never ask Karim to paste keys or passwords in chat; never print connection strings in command output; only publishable keys go in app `.env` files; never commit `.env`.
- Never change Windows security settings yourself — ask Karim to.
- Keep `CLAUDE.md` (and this brief) updated when decisions change.
- Schema changes: hand-written migration → apply to **both** cloud and local → `npm run db:pull` → mirror in `database/dvote_schema.sql` (details in `CLAUDE.md`).
