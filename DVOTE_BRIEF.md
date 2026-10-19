# dvote — Project Brief (handoff)

> **Read this first.** A self-contained summary of the dvote business, product, technical setup,
> current status and working agreements, written so a new Claude session (or person) can pick up
> the project cold. Last updated **2026-10-17**.
>
> - Technical rules for coding live in [`CLAUDE.md`](CLAUDE.md) (loaded automatically by Claude Code in this repo).
> - Full original spec: `docs/Coffee_Loyalty_Platform_Documentation.pdf` (v2.0; partly outdated, see §9).
> - Database source of truth: `database/dvote_schema.sql`.
> - Repo: `github.com/getdvote/dvote` — work happens on `develop`; merging needs Karim's approval.
> - **This file contains no secrets.** Keys and passwords live only in each app's `.env` (never committed).

> **Wallet redemption (2026-10-17):** dashboard Till → Redeem reward → scan static Wallet QR →
> customer name/balance and this merchant's rewards → affordable rewards enabled → confirm.
> API rechecks merchant, branch, blocked status, active reward, sold-out status, displayed price
> and sufficient points; atomic decrement + ledger + redemption snapshot, idempotent retries,
> followed by Google Wallet sync. Wallet preview takes `intent: redeem` (earning rule not needed)
> and `previewBranchId`; redeem takes staff-selected `rewardId` and optional `expectedPointsCost`.
> Original app redeem QRs still work. Customer web shows both Wallet buttons and keeps the saved
> notice; Google button disables when `hasUsers` is true, Apple remains unavailable pending setup.

> **Invitation password setup (2026-10-17):** dashboard `/set-password` handles Supabase invitation
> and recovery sessions with EN/AR password + confirmation fields, no manual publishable key.
> Existing local invite links to `/dev/staff.html` forward their browser-only fragment to the
> dashboard on port 5173. An expired/used link offers a fresh password email (user clicks to send).
> Local recovery uses the existing API dev callback; deployed invites must configure
> `STAFF_INVITE_REDIRECT_URL` and Supabase Redirect URLs to the public dashboard `/set-password`.

> **Broadcast + nearby reminders (2026-10-17):** Broadcast is now a merchant-admin feature:
> choose all customers, a built-in or custom segment and optional branch activity filter; preview,
> compose a plain-text message, confirm, then see pending/accepted/skipped/failed/uncertain results.
> Google Wallet only for now. Audience is snapshotted; blocked customers and unsaved passes are
> skipped. Three notification attempts per card per rolling 24 hours; uncertain sends are not
> automatically repeated. No real broadcasts were sent while testing. Nearby reminders are a
> separate opt-in setting: open branch map pins (up to 10) are sent to Google, which controls
> proximity/timing/text; Wallet requires precise always-on location permission. It is not live
> customer-location targeting. Migration 24 applied locally/cloud, Data API lockdown re-run.
> Apple notifications still require Apple pass issuance/certificates and the PassKit service.

> **Automatic Wallet logos (2026-10-17):** admin/merchant logo uploads create an additional opaque
> 720×720 WebP (`<original-uuid>-wallet-v1.webp`) with the intact artwork centred and empty sides
> filled from the dominant visible edge colour (white fallback for transparent edges). Google uses
> this version; the website/dashboard keep the original. Replacing/removing a logo deletes both.
> Existing uploaded logos are converted during Wallet sync; API startup resyncs linked passes.
> External logo URLs are passed through unchanged. No schema migration or separate upload needed.

> **Public card lookup (2026-10-17, latest):** mobile alone identifies the customer. An existing
> Egyptian mobile returns that customer's card for the merchant regardless of the typed name;
> if no card exists there, a new card is created for the same customer. A new mobile creates a
> customer and card. Names are required on the form but never compared with or used to overwrite
> an existing saved name. No email or OTP is required for now, as requested by Karim.

> **Wallet scan fix (2026-10-17):** staff scanner and `/api/vendor/scans/preview|collect` now accept
> `dvote:c1:` wallet card QRs as well as the app's `dvote:q1:` codes. Wallet collects are reusable
> across visits, merchant-scoped, idempotent per submission and recorded with `scan_source=wallet_card`.
> Wallet redemption selection and Google broadcasts are now built (see latest notes above).
> Dashboard Till (`MyTill.tsx`) also accepts both `dvote:q1:` and `dvote:c1:`; its separate
> client-side prefix check was corrected on 2026-10-17 after the staff-app fix.
>
> **Google Wallet sync (2026-10-17):** saved passes receive the latest points after collects,
> redemptions and admin corrections, plus merchant colour, logo and banner after dashboard changes.
> Updates run after commit without blocking the till. Failed/missed updates retry every minute and
> on API startup using the existing `pass_updated_at` checkpoint; no new database migration.
> Google controls the native pass layout (web gradients/patterns are not reproduced). Apple pass
> issuing/update support and lock-screen notification messages remain pending.

> **⚠ Direction change 2026-10-17 — wallet passes instead of a customer app.** Customers no longer
> install an app. At the till an **NFC tag / QR** opens a mobile web page; the customer types name,
> email and phone and gets a **loyalty card for that merchant as a Google Wallet (Android) or Apple
> Wallet (iPhone) pass**, showing their points and a QR the cashier scans with the staff app. The pass
> updates itself after every collect / redeem. The customer app is **paused, not deleted** (it may ship
> later and will show the same cards). Sections below still describe the app flow; the full new plan
> (journey, backend, database, open questions) is in [`CLAUDE.md`](CLAUDE.md) → "Direction change".

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
| **Vendor dashboard** (React web) | Vendor admins, branch managers | Branches, staff, point rule, rewards, menu/photos, profile, overview | Built 2026-10-09 (`apps/dashboard`, same app as admin; sees only its own vendor) |
| **Admin dashboard** (React web, `apps/dashboard`, port 5173) | dvote platform admins | Overview charts; vendors (create, edit, suspend, logo, branches, points rule, rewards incl. Arabic, menu & photos, staff, invite owner); customers (search, details, block) | **Built** (sign-in with authenticator code) |

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
10. **Tenant isolation:** a vendor's staff can only ever see/act on their own vendor's data (other vendors' rows look like "not found"). Merchant admins and branch managers can see customer names and merchant-scoped loyalty profiles in Customers. Email, phone, auth identifiers and other private profile data are excluded from merchant API responses. Branch managers see only customers and activity in their assigned branch.
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
| Web dashboards (admin built) | React + Vite + Tailwind + shadcn/ui + TanStack Query + Recharts, one app with vendor/admin routes |
| API contract (planned) | OpenAPI from NestJS → generated typed client `packages/api-client` (apps use hand-written types until then) |
| Hosting v1 (planned) | One API container + the managed database. No microservices, queues or Redis |

**Repo layout:** `apps/api` (NestJS) · `apps/staff` (staff app) · `apps/mobile` (customer app) · `apps/dashboard` + `packages/api-client` (placeholders) · `database/` (schema, seed, Supabase lockdown script) · `docs/` (spec PDF + its HTML source).

**Database (14 tables):** `vendors`, `branches`, `staff_users`, `point_rules`, `rewards`, `users` (customers; includes optional `gender`, `birth_date`), `user_identities` (unused), `cards`, `qr_codes`, `point_events` (ledger), `redemptions`, `platform_admins`, `fraud_flags`, `vendor_images` (menu pages + branch photos). Many rules are enforced by the database itself (constraints, composite foreign keys so points can't cross vendors, a trigger that blocks editing/deleting ledger rows). Migrations `0`–`6` are applied to both cloud and local.

**Security notes:**
- Supabase's automatic public table API is **locked** (`database/supabase_lockdown.sql`: row-level security on every table, no grants for the public roles). Re-run it after adding any table.
- The Supabase **secret key** lives only in `apps/api/.env`. Apps only get the **publishable** key.
- ⚠️ The Supabase secret key was once pasted in chat → **should be rotated** (Project Settings → API Keys).

---

## 7. What's built (as of 2026-10-08)

**API (`apps/api`)** — 128 end-to-end + 47 unit tests passing.
- Health check, Swagger at `/api/docs` (dev only).
- Customer: `GET|PATCH /api/app/users/me` (name, phone, gender, birthday), `PUT|DELETE /api/app/users/me/avatar` (profile photo), `GET /api/app/cards`, `GET /api/app/cards/{id}/events`, QR codes (create / poll / cancel), feedback (to a Google Sheet).
- Staff: `GET /api/vendor/staff/me`, staff CRUD with role rules, `GET|PATCH /api/vendor/profile`, `PUT|DELETE /api/vendor/profile/logo`, `GET|POST|DELETE /api/vendor/images` (menu pages + branch photos), `POST /api/vendor/scans/preview`, `POST /api/vendor/scans/collect`.
- Admin: vendors CRUD + logo upload + invite vendor admin (2FA required).

**Image storage (Supabase Storage):** bucket **`vendors`** (public: `<vendor>/logo/…`, `<vendor>/menu/…`, `<vendor>/branches/<branch>/…`) and bucket **`avatars`** (private: `<user>/…`, shown only to the owner via 1-hour signed links). Apps send images to the API, never to Storage directly; the API checks and shrinks them to WebP. Replacing or deleting an image deletes its file. Buckets are created with `npm run storage:setup`.

**Customer app (`apps/mobile`)** — welcome (Google / Facebook / email sign-up + log-in, forgot/reset password, email confirmation), Cards list + per-card history, "You" hub, **Explore** (every shop with its rule, rewards/branches count and your points; search), **English + Arabic** (Settings → Language; English default, right-to-left Arabic), Profile details (**photo** add/change/remove, name, phone, gender switch, **birthday calendar** with validation), **shop page** (how you earn points, rewards with "pts to go", menu pages, branches with directions and photos), Settings, About, **collect QR screen** with live "+N points" update. Placeholders: Discover (needs vendors API), feedback / help / terms / join-as-vendor content, delete account.

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
- **Images:** customers can set their photo and see shop menus/branch photos; vendors still upload menu pages, branch photos and logos through the API (Swagger/Postman) until the dashboard has upload screens.
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
| 2026-10-17 | **Storefront feedback:** optional Feedback section opens a public name/comment form with optional Egyptian mobile. Stores merchant/branch feedback without creating users or cards. A phone match to an existing merchant card is labelled for the merchant only (unverified). Dashboard Feedback lists comments newest first; branch managers see only their own branch. Migration 24 enables RLS and denies direct public table access. |
| 2026-10-17 | **Customer app archived** at git tag `customer-app-v1` (folder `apps/mobile` removed from `develop`; restore with `git checkout customer-app-v1 -- apps/mobile`). Public address **`dvote.app/<merchant-slug>`** (e.g. `dvote.app/joy-corner`). Join requires a **confirmed email** and an **Egyptian mobile number**; **merchants can see customer email + phone**. Wallet notifications later. |
| 2026-10-17 | **Wallet passes instead of the customer app.** NFC tag + QR at each till → mobile web join page (name, email, phone, "how did you hear", 14+) → loyalty card per merchant added to **Google Wallet on Android / Apple Wallet on iPhone** (button chosen by the phone, the other kept as a small fallback). The pass shows points, name, short code and a **static card QR** that staff scan; it updates after every balance change. Staff now start redemptions (scan card → pick reward). Cards are created when the customer joins (balance 0), not on the first purchase. Customer app paused, kept for later. Needs: Google Wallet issuer account (free), Apple Developer account ($99/yr) for Apple Wallet, a public domain. Reference: tappi. |
| 2026-10-14 | Reward retail value (optional normal selling price, merchant currency) and estimated give-back rate on Insights (retail value is entered in reward forms): retail value / (points cost × spend amount / points per spend). Uses the active rule; rounding, minimum bills and caps can increase actual spend. Migration 15 applied to cloud; local deploy blocked because the configured `postgres` role is missing. |
| 2026-10-10 | **Vendors are called "merchants" in every app's text** (dashboard, staff app, customer app). Code, API routes and database keep `vendor`. |
| 2026-10-10 | **Merchant Insights page**: sales through dvote, visits, average bill, customers (new / returning), repeat rate and rewards for any period vs the one before, per branch. Counts only. |
| 2026-10-10 | **Dashboard home "Needs your attention"**: what stops customers today (no rule, no rewards, branch closed, sold out), unusual activity (a card collecting > 3× a day, a cashier far above their usual, a bill > 5× the branch average) and missing setup, each with the action that fixes it. Unusual activity only points, never blocks. |
| 2026-10-10 | **Branch hours per weekday with split shifts** (e.g. 09:00–15:00 and 17:00–01:00, closed Fridays), and **"temporarily closed"** for 30 min to rest of today, set by the branch manager or merchant admin; customers see it on the shop page. It doesn't block scans. Migration 14. |
| 2026-10-10 | **Rewards can be sold out per branch** (e.g. no cheesecake at Zamalek today): for 2 h / 4 h / rest of today / until put back, set by the branch manager (own branch) or merchant admin (one or all branches). Staff at that branch can't give it; customers see where it's sold out but can still redeem at other branches. New table `reward_sold_outs` (migration 13). |
| 2026-10-10 | **Merchant redemptions page** (`GET /api/vendor/redemptions`, dashboard page Redemptions): rewards given with totals and a per-reward breakdown; names and costs as they were when given. |
| 2026-10-10 | **Merchant activity log** (`GET /api/vendor/events`, dashboard page Activity): every collect / redemption / correction with branch, staff, bill and receipt; customers appear only as a card code (first 6 characters of the card id), never by name. |
| 2026-10-09 | **Two kinds of collect QR.** The main QR (tab bar) works at any shop. A shop QR (Collect on a shop page) works only at that shop: another shop's staff get "This QR is for another shop" and give no points. Replaces the 2026-10-08 "no shop QRs" rule. |
| 2026-10-09 | **Reward photos** (one per reward, uploaded from either dashboard, stored at `<vendor>/rewards/`). **Branch locations are picked on a map** (search, Google Maps link, or click), never typed. Branch photos moved to the Branches page. |
| 2026-10-09 | Customer app **refreshes itself** every 20 s on the visible screen (and when reopened), so dashboard edits show up without pulling down. |
| 2026-10-08 | **Customer app in English and Arabic** (English default; switch in Settings; Arabic is fully right-to-left with an Arabic font; proper Arabic plurals). Shop data (names, rewards) stays as the shop typed it. |
| 2026-10-08 | **Image storage:** Supabase Storage, folders by **id** (never names), random file names, public `vendors` bucket + private `avatars` bucket, uploads only through the API (WebP), deleting an image deletes its file. Menu pages + branch photos in `vendor_images` (migration 6). |
| 2026-10-08 | Code review: `getdvote` GitHub account is the only code owner/reviewer; Karim and Mohamed open PRs from their own accounts. |
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

### Redemption Wallet confirmations (2026-10-17)
- Successful reward redemptions (Wallet card or app QR) queue a Google Wallet message: "You have redeemed your reward successfully", with reward, points spent and remaining balance. The durable outbox is written in the redemption transaction; Google delivery runs afterward through the existing five-second worker, so provider failures cannot undo points. Idempotent redemption retries create only one message. Transactional messages are excluded from Broadcast history and share its three-per-card rolling-day notification allowance; delivery still depends on Google/device notification settings. Apple notifications await Apple pass setup.
- Customer card page keeps both Wallet buttons visible and disables each only when that wallet is saved (or Google is busy). Apple remains clickable and explains that setup is pending; it cannot issue a pass yet.
- Validation: API and customer web builds; redemption, Broadcast and Google Wallet e2e suites (23 tests), including duplicate redemption notification prevention and provider-failure balance preservation.

### Wallet delivery diagnostics (2026-10-17)
- Investigated real missing redemption notifications: one provider-error outcome and one local daily-limit skip; the pass already had two accepted Broadcast messages. Retried the missing confirmation once using its existing message ID, verified it exists on Google's pass, reconciled its delivery row to accepted, and the customer confirmed the phone notification appeared. The original provider error had not been logged, so its exact cause remains unproven.
- Wallet worker now logs controlled Google HTTP diagnostics and records definite 4xx rejections as failed/provider_http_<status>, rather than unknown. Definite rejections no longer consume the local rolling notification quota; ambiguous network/server failures remain unknown to prevent unsafe duplicate sends.

### Staff home refresh and web dependencies (2026-10-17)
Staff home (web/iOS/Android shared screen) now has a faded vendor-logo watermark, larger welcome/vendor heading, a scan action panel and scrollable layout for smaller screens. Other staff screens retain the compact header. No new packages required for this UI. Staff lint/typecheck pass. Customer image-viewer import failure after pulling changes was caused by missing installed dependencies; installed the existing locked dependencies in apps/web and apps/dashboard without changing manifests or lockfiles.

### Staff app aligned with dashboard design (2026-10-17)
Staff login, home, scan, bill amount, reward confirmation and success screens use the dashboard's light stone palette, Inter regular/medium/semibold/bold fonts, dark dvote brand bar, white bordered panels and 12px controls. Mobile touch targets stay at least 52px for primary actions; the centered task column is capped at 560px on web. Home retains the faded vendor logo and larger welcome. Inter assets load locally via Expo-compatible expo-font and @expo-google-fonts/inter; only the four required faces are imported. Staff theme owns native equivalents of dashboard tokens; Field focus has a visible border. Scanning and points behavior is unchanged. Checked with staff lint/typecheck and Expo web export; physical iOS/Android visual review remains manual.

### Platform staff onboarding (2026-10-17)
Platform admins can now invite all four roles through POST /api/admin/vendors/{id}/staff. When a vendor has no staff rows, the first member is forced to vendor_admin with no branch (both UI and API); afterward the selected role is respected. Merchant-wide roles omit branches; staff/branch_manager require an active branch of that vendor. Existing /admins stays compatible. Dashboard admin Staff tab shows a first-admin explanation initially, then the role picker; merchant-side permissions remain unchanged. First-member creation uses a vendor row lock in the insertion transaction. No migration. API build and 61 admin/staff e2e tests pass. Installed the dashboard's already-declared html-to-image dependency to restore QR poster rendering imports.

### Staff home cleanup and one vendor admin (2026-10-17)
- Staff home replaces the oversized rotated rectangular watermark with a small faint circular logo; header vendor images are circular and the dark brand bar no longer tints the opaque PNG into a white block. Layout widths/min-width and clipping keep the page inside the viewport. Branch choices are full-width rows with wrapped names and a selection indicator. Home keeps the dashboard palette and Inter.
- Exactly one vendor_admin row is allowed per vendor, including disabled accounts. Migration 27_one_vendor_admin adds a partial unique index on staff_users.vendor_id WHERE role='vendor_admin', applied to cloud and local. API rejects duplicate invitations (both new /staff and legacy /admins), merchant-side invites and promotions with 409 vendor_admin_exists; transaction vendor locks cover concurrent decisions, and preflight validation avoids unnecessary emails. Dashboard hides admin when the vendor already has one. No existing accounts were demoted or deleted; cloud duplicate check was empty.
- Prisma introspection fix now restores the many-staff vendor and branch relations after removing the misleading partial @unique attribute. npm run db:pull completed. Local DB's previously pending feedback migrations were completed with conditional revokes for absent Supabase roles; 24/25/26/27 are now applied there. Existing migration files were preserved.
- Validation: API/dashboard builds, 71 admin/staff/dashboard e2e tests (including concurrent admins, disabled admin, direct DB uniqueness), staff lint/typecheck and web export pass. Phone visual review remains manual.

### Staff Collect/Redeem tabs and merchant role wording (2026-10-17)
Staff Home now has Collect and Redeem tabs; branch selection is shared. Collect keeps the receipt amount flow. Redeem scans a saved Wallet card, loads customer name/balance and this merchant's active rewards with branch sold-out and affordability flags, disables unusable choices, then loads a fresh confirmation preview before Give reward. Sends rewardId + expectedPointsCost and an idempotency key to the existing transactional redeem endpoint; backend wallet sync/notification behavior remains shared. Original one-time reward QRs go straight to confirmation in the Redeem tab; collect QRs are refused there with guidance. Returning from a redemption preserves the Redeem tab; no active earning rule is required to redeem. QR secrets remain session-memory only. Customer information is fetched from the API rather than passed in confirmation-route JSON.
Dashboard vendor_admin role labels now read Merchant admin / مسؤول المتجر, including the platform Feedback table. The database role and its permissions remain vendor_admin; it is not a dvote platform super admin.
Validation for staff tabs: lint/typecheck pass, Expo export succeeds for web/Android/iOS, dashboard build passes, and all 47 collect/redeem backend integration tests pass. No real points were granted or redeemed during automated verification.

### Staff app access (2026-10-17)
Only vendor_admin (Merchant admin), branch_manager and staff can enter the staff web/mobile app. Session loading checks the server-returned role for both password sign-in and restored sessions before exposing Home; viewers are signed out locally and shown a dashboard-only explanation. A role refusal from scan endpoints also clears staff app access. Local sign-out avoids revoking the viewer's other dashboard sessions. API ScansController already restricts preview/collect/redeem/today to the same three roles; viewer dashboard access is unchanged. Validation: staff lint/typecheck, explicit role allowlist checks, staff web export, and 12 redemption e2e tests including all three roles collecting/redeeming and viewer refusal at every scan endpoint.

### Branch map polish (2026-10-17)
LocationPicker uses a taller rounded map panel, softened OSM tile colors, theme-aware zoom controls, a clearer dark pin, compact search/location actions and a collapsible Google Maps link field. Leaflet's default Ukraine-flag prefix is replaced with a plain linked Leaflet credit; OpenStreetMap attribution remains. ResizeObserver keeps the map correctly sized in branch dialogs; wheel zoom is disabled to avoid trapping form scrolling (buttons/pinch remain). Selection guidance is localized EN/AR. Dashboard typecheck/build passes; no new map provider or dependency.

### Automatic light/dark branch maps (2026-10-17)
All embedded maps currently use the shared dashboard LocationPicker (admin/merchant Add and Edit branch forms). Replaced its Leaflet renderer with a lazy-loaded MapLibre BranchMap using OpenFreeMap's OpenMapTiles-derived Positron style in light mode and Dark Matter-derived dark style in dark mode. useTheme.resolvedTheme follows explicit light/dark and system preference; setStyle preserves camera/pin. No API key or added provider account. Provider/data attribution comes from the vector source (OpenFreeMap/OpenMapTiles/OpenStreetMap). Removed the previous raster color filter; controls and pin use dashboard theme colors. Vite worker is explicitly bundled per OpenFreeMap's quick start. Click/drag, search, link, geolocation and resize behavior are retained. WebGL failure shows localized guidance so search/link can still set coordinates. Other apps have outbound Google Maps directions links, not embedded map previews. Dashboard build passes and both style/TileJSON endpoints returned HTTP 200.

### Automatic broadcast audience (2026-10-19)
Broadcast in both merchant and platform-admin merchant workspaces loads target audience counts automatically on opening and whenever the audience or branch filter changes. The manual Check audience button is removed. Loading or failed previews disable sending so confirmation uses the current selection; sending still requires explicit confirmation.

## Platform-wide merchant operations (2026-10-18)

The platform admin dashboard now includes merchant operations that were previously only available to merchant accounts. All-merchants views support search and pagination; choose a merchant to open its complete editor/workflow. Existing platform Customers, Statistics, merchant support Feedback and System pages remain separate.

| Merchant feature | Platform-admin entry |
| --- | --- |
| Home, onboarding, attention | Merchant overview (/merchant-home), choose merchant |
| Storefront, menu, branding | Storefronts (/storefront), Merchant settings (/settings) |
| Branches, pause/resume, photos | Branches (/branches) |
| Card design and earning rule | Loyalty cards & points (/card) |
| Rewards, sold-out controls, redemption history | Rewards (/rewards), Redemptions (/redemptions) |
| Customers, built-in/custom segments, CSV export | Customer segments (/members) |
| Segmented Wallet messages and nearby settings | Broadcast (/broadcast) |
| Ledger activity, reports and patterns | Activity (/activity), Insights (/insights) |
| Customer-to-merchant feedback | Customer feedback (/customer-feedback) |
| Team invitations, enable/disable, role/branch/name edits | Merchant teams (/team) |
| Collect/redeem Wallet or one-time QR | Till (/scan); merchant and active branch required |
| Store kits | /kit (same existing Coming soon content) |
| Platform-admin operation history | Admin action log (/audit) |

API: GET /api/admin/workspace/:section supplies the cross-merchant listings. /api/admin/vendors/:workspaceVendorId/workspace/... reuses the validated merchant controllers with PlatformAdminGuard + an explicit merchant scope. It requires the real platform admin identity and MFA; it never logs in as, creates, or borrows a merchant staff account. Scoped dashboard requests use createVendorApi(prefix), VendorWorkspaceProvider and an isolated TanStack Query cache per merchant. Internal links preserve the merchant query parameter.

Migration 28_admin_workspace is applied locally and on Supabase; the lockdown script was refreshed. Collect/redeem ledgers use point_events.created_by for the platform admin and null staff_id; QR usage, redemptions and Wallet notification outboxes have explicit admin actor columns and exclusive actor checks. All other scoped writes have admin_actions intent/result records (actor, merchant, method, path, outcome; no request bodies or secrets). Merchant business constraints still apply: one merchant admin, tenant/branch boundaries, available reward, sufficient balance, idempotency and ledger consistency. Suspended merchants can be inspected/configured but cannot run till transactions.

Verification: local API integration tests cover every global/scoped read, admin/MFA denial, cross-merchant writes, segment membership, sold-out controls, team edits, one-time QR attribution, Wallet collect/redeem idempotency, ledger totals, and redemption notification actor. UI tests exercise every global/selected-merchant route with mocked services, plus merchant selection; no real broadcasts are sent by tests.

**Admin workspace UUID fix (2026-10-18):** use the shared UUID_PATTERN (PostgreSQL-compatible) in AdminWorkspaceGuard. Joy Corner’s seeded version/variant-zero UUID must work on Insights and all other workspace pages; class-validator isUUID rejects it. Local integration coverage now uses a random seed-style merchant UUID and checks malformed/missing IDs still return 404.

**Admin workspace navigation fix (2026-10-18):** merchant selection is owned by the vendor URL query parameter. Clicking a sidebar page (including the current Till page) clears selection and returns to All merchants. Shared merchant tabs/filters use useWorkspaceSearchParams to retain vendor explicitly, instead of an effect restoring stale selection after navigation.

**Admin sidebar sections (2026-10-18):** Overview and Till stay at the top. The admin menu now mirrors the merchant dashboard’s Management, Loyalty and Workspace groups, plus Platform for merchant support, the admin action log and System. Each page has an appropriate linear icon and matching active duotone icon; all existing routes are retained.
