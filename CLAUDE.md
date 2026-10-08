# dvote — Loyalty Platform

Spend-based loyalty points and vendor rewards for coffee shops, collected and redeemed with **one-time QR codes**.
Each vendor sets a **point rule** (e.g. every 10 EGP = 1 point) and a **reward catalogue** priced in points (e.g. free coffee 300, free cheesecake 500, coffee + cheesecake 750). The customer shows a QR in the app; vendor staff scan it in the staff app and enter the receipt total (collect) or confirm the reward (redeem); the backend decides and records everything.

Four clients:

| Client | Users | Purpose |
|---|---|---|
| Customer app (React Native + Expo, iOS + Android) | Customers | Sign in, see cards (points per vendor), browse vendors + rewards, show collect / redeem QR |
| Staff app (React Native + Expo, separate app) | Staff, branch managers, vendor admins | Scan customer QR, enter receipt total, confirm redemptions |
| Vendor dashboard (React, web) | Vendor admins, branch managers | Branches, staff, point rule, rewards, reports |
| Admin dashboard (React, web) | Platform admins | All vendors, onboarding, support, point corrections, fraud review |

**Business + status handoff: [`DVOTE_BRIEF.md`](DVOTE_BRIEF.md)** (read it first; keep it updated). Full spec: `docs/Coffee_Loyalty_Platform_Documentation.pdf` (v2.0; source `docs/src/documentation.html`, rebuild with `node docs/src/build-pdf.mjs`). Database source of truth: `database/dvote_schema.sql`.

---

## Tech stack (decided)

- **Backend:** NestJS (TypeScript), Prisma ORM, PostgreSQL (Supabase Postgres 17 in the cloud; local PostgreSQL 18 for tests)
- **Web dashboards:** React + TypeScript (Vite), Ant Design, TanStack Query, Recharts. One app, role-based routes for vendor and admin.
- **Mobile:** two React Native + Expo (TypeScript) apps — customer app (shows QR codes) and a separate staff app (camera QR scanner). `@supabase/supabase-js` for sign-in. No NFC.
- **API contract:** OpenAPI generated from NestJS → one typed TypeScript client (`packages/api-client`) shared by the dashboard and both apps.
- **Auth: Supabase Auth.** (The database is Supabase Postgres too, since 2026-10-08, but the apps never talk to it: only NestJS does, via Prisma. See Database.) Supabase issues and refreshes all tokens; NestJS only verifies them locally against the project's JWKS (`SUPABASE_URL/auth/v1/.well-known/jwks.json`, via `jose`) and maps the token's `sub` to our own rows. NestJS never issues JWTs.
- **Customer auth:** Google, Facebook, or **email + password** (decided 2026-10-03) through Supabase. Email sign-ups must confirm their email before Supabase issues a token — keep Supabase "Confirm email" ON. NO phone/SMS (costs money; later), no anonymous — the guard (`CUSTOMER_PROVIDERS`) rejects other providers with `provider_not_allowed`. The sign-up name is passed as `full_name` user metadata. Supabase links providers with the same verified email into one auth user. `users.auth_user_id` = Supabase user id; the row is created on the customer's first API call.
  - **Apple is postponed** (needs the paid Apple Developer Program, $99/yr). To add it: enable it in Supabase and add `'apple'` to `CUSTOMER_PROVIDERS` in `auth/customer-auth.guard.ts`. An iOS App Store release that offers Google/Facebook login will likely need Sign in with Apple too (App Store guideline 4.8).
- **Staff auth (built):** Supabase email + password (Google also works if the email matches). Invite-only: `POST /api/vendor/staff` calls Supabase `inviteUserByEmail` with the server-only `SUPABASE_SECRET_KEY` and stores `staff_users.auth_user_id`; if the email already has a Supabase account (e.g. a customer), it is linked without an email. `StaffAuthGuard` requires an active staff row in an active vendor (and active branch for branch roles) and builds the `StaffContext` used for tenant scoping. `password_hash` is legacy/nullable. Onboarding is API-only: a platform admin creates the vendor (`POST /api/admin/vendors`) and its vendor admin (`POST /api/admin/vendors/{id}/admins`, invite email); that vendor admin adds managers and staff with `POST /api/vendor/staff`. Staff never self-sign-up. (No script for vendor admins — removed on purpose.)
- **Platform admin auth (built):** Supabase email + password + MFA (TOTP). `PlatformAdminGuard` requires an active `platform_admins` row (`auth_user_id`) and an `aal2` token, unless `ADMIN_MFA_REQUIRED=false` (local dev only; default true). Platform admins are created only by `npm run admin:create -- --name … --email … --password …` (from `apps/api`) — the one bootstrap script; no API. Use an email without an existing Google-only Supabase account (e.g. a `+admin` Gmail alias), or password sign-in fails. Error codes: `not_admin`, `admin_disabled`, `mfa_required` (403).
- **Hosting v1:** one backend container + one managed PostgreSQL (Supabase). No microservices, queues or Redis.

## Repo layout (monorepo)

`apps/api` is self-contained (own `package.json`, lockfile, `node_modules`, `.env`); run Nest/Prisma commands from `apps/api` (Prisma config: `prisma7.config.ts`). `apps/staff` is the **built** staff app (Expo SDK 57 + Expo Router, web + iOS/Android from one codebase; own `package.json`/`.env`; see its README and `AGENTS.md`: always check versioned Expo docs, add packages with `npx expo install`). `apps/mobile` is the customer app (Expo SDK 57 + Expo Router, **iOS/Android product**, scheme `dvote`; same conventions as `apps/staff`; `npm run web` on 8082 is a dev-only preview for the browser pane, not a shipped target). **Languages: English (default) + Arabic** — see "Customer app localization" below. `dashboard` and `api-client` are placeholders — not scaffolded yet. Root `package.json` has convenience scripts `api:*`, `admin:create`, `staff:*`, `mobile:*` (no npm workspaces yet; add them when the other packages get a `package.json`).

```
dvote/
├── CLAUDE.md
├── docs/                      # spec PDF + its HTML source (docs/src)
├── database/
│   ├── dvote_schema.sql       # schema source of truth (14 tables, v2.0)
│   └── dvote_seed_joy_corner.sql   # dev seed: Joy Corner, 10 EGP = 1 pt, 3 rewards
├── apps/
│   ├── api/                   # NestJS + Prisma
│   ├── dashboard/             # React (vendor + admin)
│   ├── mobile/                # React Native (Expo) customer app — iOS/Android (in progress)
│   └── staff/                 # React Native (Expo) staff scanner app — web + native (built)
└── packages/
    └── api-client/            # generated TS client from OpenAPI
```

---

## Database

**App DB: Supabase Postgres 17** (project `cfknsqlixyeihhkleock`, region eu-west-1, Free plan: pauses after 1 week idle, no backups — Pro before real customers). `apps/api/.env` `DATABASE_URL` = the **Session pooler** URL (`aws-1-eu-west-1.pooler.supabase.com:5432`, user `postgres.<ref>`; the direct `db.<ref>.supabase.co` host is IPv6-only and unreachable here; password letters+digits only). Never commit it. **Supabase Data API is locked:** `database/supabase_lockdown.sql` (RLS on every table, no policies, no grants for `anon`/`authenticated`; NestJS connects as the owner, unaffected) — re-run it after any migration that adds a table. Migrations on the cloud: `npx prisma migrate deploy` (DATABASE_URL already points there).
**Local DB** `postgresql://postgres:<password>@localhost:5432/dvote` = `TEST_DATABASE_URL`, used **only by e2e tests** (`test/setup-env.ts` swaps it in and refuses any non-local host: the cleanup needs superuser, and tests must never touch cloud data). Keep local schema in step with the cloud (apply each migration to both). Prisma lives in `apps/api/prisma/`; migrations `0_init`, `1_users_auth_user_id`, `2_staff_users_auth_user_id`, `3_points_rewards_qr`, `4_platform_admins_auth_user_id`, `5_users_gender_birth_date`, `6_storage_images`, `7_rewards_arabic` are applied (local and cloud). `database/dvote_schema.sql` is the full current schema (a DB built from it matches all migrations: mark them applied with `npx prisma migrate resolve --applied <name>`). The Prisma client is generated into `apps/api/src/generated/prisma` (git-ignored; import from `generated/prisma/client.js`).

**Schema changes:** hand-write `prisma/migrations/<n>_<name>/migration.sql`, apply with `npx prisma migrate deploy`, refresh `schema.prisma` with **`npm run db:pull`** (= `prisma db pull` + `prisma/fix-introspection.cjs` + `prisma generate`; never plain `db pull`: the fix-up stops Prisma reading the partial "one active rule per vendor" index as a one-to-one relation), and mirror the change in `database/dvote_schema.sql`. Avoid `migrate dev` on the local DB: drift from objects Prisma can't model can make it offer a reset, which wipes the seed data. Prisma cannot express the partial unique indexes, CHECK constraints, composite FKs-with-intent or triggers below, so **never let a Prisma migration drop them**.

### Tables (14)

| Table | Side | Purpose |
|---|---|---|
| `vendors` | vendor | Brand (tenant root). `currency` (default EGP). status active/suspended. `logo_url` (public link) + `logo_path` (set when the logo was uploaded to Storage) |
| `branches` | vendor | Physical shop. FK vendor |
| `staff_users` | vendor | role: vendor_admin (branch_id NULL) / branch_manager / staff (branch_id required); `auth_user_id` |
| `point_rules` | vendor | Earning rule, versioned: `spend_amount`, `points_per_spend`, `min_purchase`, `max_points_per_purchase`, `is_active` |
| `rewards` | vendor | Reward catalogue: `name`, `description`, `name_ar`/`description_ar` (Arabic, optional), `points_cost`, `status` active/archived, `sort_order` |
| `users` | customer | Customers. email nullable, phone optional, `gender` (male/female, NULL = not given), `birth_date` (plain `date`), `avatar_url` (sign-in provider photo), `avatar_path` (uploaded photo in Storage), `auth_user_id` |
| `user_identities` | customer | **Unused** (Supabase handles provider identities and linking) |
| `cards` | customer | One per (user, vendor), created on first purchase. `balance` (cached), `lifetime_points` |
| `qr_codes` | activity | One per QR shown. purpose collect/redeem, `vendor_id` (always NULL for collect; the reward's vendor for redeem), `reward_id` (redeem), `token_hash`, status active/used/expired/cancelled, `expires_at` (5 min) |
| `point_events` | activity | **Ledger, append-only.** earn (+points, `purchase_amount`, `rule_id`) / redeem (−cost, `reward_id`) / adjust (admin + reason). `qr_code_id`, `staff_id`, `branch_id`, `receipt_ref` |
| `redemptions` | activity | One per reward given, 1-to-1 with its redeem ledger row; snapshots `reward_name`, `points_cost` |
| `platform_admins` | platform | Internal team. `auth_user_id`; 2FA via Supabase MFA (`password_hash`, `totp_secret_ref` legacy) |
| `fraud_flags` | platform | too_many_collects / large_purchase / branch_spike / staff_spike; targets vendor/branch/user/staff |
| `vendor_images` | vendor | Menu pages (`kind` menu, no branch) and branch photos (`branch_photo`, composite FK branch+vendor). `storage_path`, `sort_order`. **Hard-deleted together with its file** (media, not business history) |

All tables: `id uuid` (gen_random_uuid), `created_at`, `updated_at` (trigger-maintained, timestamptz UTC). Soft delete via `status`; never hard-delete business rows (exception: `vendor_images`, deleted with their file).

### Image storage (Supabase Storage, built 2026-10-08)

Buckets (created/updated by `npm run storage:setup`, idempotent; WebP only, at most 2 MB per file):
- **`vendors` (public):** `<vendorId>/logo/<uuid>.webp`, `<vendorId>/menu/<uuid>.webp`, `<vendorId>/branches/<branchId>/<uuid>.webp`. Permanent links (`/storage/v1/object/public/...`).
- **`avatars` (private):** `<userId>/<uuid>.webp`. Only shown to the owner, as a **signed link valid about 1 hour** (`avatarUrl` in `/users/me`).

Rules: **apps never upload to Storage directly.** They send `multipart/form-data` (field `file`, at most 10 MB, JPG/PNG/WebP/HEIC) to the API, which re-encodes it with `sharp` (avatar 512x512 crop, logo fits 512, menu page 1600, branch photo 1280; metadata stripped) and uploads with the secret key. Code: `src/storage/` (`StorageService`, `images.ts`, `ImageUploadInterceptor`, `@ApiImageUpload()`) and `src/vendor-images/`. File names are random and never reused, so links can be cached forever. Replace = upload new file, update the row, then delete the old file; delete = delete the file, then update/delete the row. Setting `logoUrl` by PATCH (or null) deletes an uploaded logo file. e2e tests replace `StorageService` with `test/helpers/fake-storage.ts` (`test/images.e2e-spec.ts`). Limits: 20 menu pages per vendor, 10 photos per branch. Error codes: `file_required`, `invalid_upload` (400), `file_too_large` (413), `unsupported_image` (415), `too_many_images` (409), `image_not_found` (404), `storage_not_configured`, `storage_error` (503).

### Constraints enforced by the DB (keep them; handle their errors in the API)

- One active point rule per vendor (partial unique index); `UNIQUE (vendor_id, version)`.
- `cards`: `UNIQUE (user_id, vendor_id)`, `balance >= 0`.
- **Points never cross vendors:** `point_events` and `redemptions` carry `vendor_id` and composite FKs `(card_id|branch_id|rule_id|reward_id, vendor_id)`; `qr_codes (reward_id, vendor_id)` likewise.
- `point_events`: earn ⇒ delta > 0, purchase_amount > 0, rule, QR, staff, branch set; redeem ⇒ delta < 0, reward, QR, staff, branch set; adjust ⇒ created_by + reason. `idempotency_key` UNIQUE. At most one event per QR (partial unique). `receipt_ref` unique per branch for earns.
- `point_events` UPDATE/DELETE raise an exception (trigger). Corrections = new `adjust` row.
- `qr_codes`: redeem ⇒ vendor + reward set; collect ⇒ no reward; used ⇒ used_at, used_by_staff_id, used_branch_id set.
- `staff_users`: branch must belong to the same vendor (composite FK); role/branch rule (CHECK).
- `fraud_flags`: at least one target; non-open ⇒ reviewed_by set.

---

## Core business rules (invariants)

1. **Points live at vendor level** on the customer's card for that vendor. Earned at any branch of the vendor; never move between vendors.
2. **The server decides points, never the apps.** The customer app only shows a code; the staff app only sends the code and the receipt total.
3. **Points formula:** `floor(amount / spend_amount) * points_per_spend`, capped at `max_points_per_purchase`; 0 if `amount < min_purchase`. Round **down**. Money is `numeric(12,2)` in the DB and integer minor units (piastres) in code — never floats. 0 points ⇒ reject `no_points_earned`, write nothing.
4. **Ledger is the source of truth.** `cards.balance` must always equal `SUM(point_events.delta)` for that card. Every balance change happens in the same DB transaction as its ledger insert.
5. **Cards are created on the first purchase** at a vendor (no points ⇒ no card).
6. **Customer chooses when to redeem.** Leftover points stay (1000 − 300 = 700).
7. **Rule / reward versioning.** A new rule = new `point_rules` row (version + 1, active); applies from then on, past earns keep `rule_id`. Reward edits apply to future redemptions; `redemptions` snapshots name + cost. Archived rewards can't be redeemed.
8. **QR codes are one-time server-issued secrets**: 128-bit random code in the QR (`dvote:q1:<code>`), only its SHA-256 stored, valid 5 min, single use; issuing a new QR of the same purpose cancels the customer's previous active one. Never put the user id in a QR.
9. **Vendor and branch come from the scanning staff member**, never from the customer's phone. Vendor admins (no branch) must send `branchId`.
10. **Tenant scoping.** Every vendor-side query filters by the `StaffContext` (vendor, and branch for branch roles), built once in `StaffAuthGuard` — never per endpoint by memory. Other vendors' rows → 404.

---

## Collect flow (earn points)

1. Customer app: `POST /api/app/qr-codes {purpose:"collect"}` → `{id, code, expiresAt}`. **A collect QR never names a vendor** (decided 2026-10-08: no vendor QRs, the customer can't pick the wrong shop; sending `vendorId` → 400). The vendor and branch always come from the scanning staff member. App shows QR and polls `GET /api/app/qr-codes/{id}` every 2 s.
2. Staff app scans → `POST /api/vendor/scans/preview {code}` → what it is (no customer personal data).
3. Staff enter the total → `POST /api/vendor/scans/collect {code, amount, receiptRef?, branchId?, idempotencyKey}`.
4. Checks **in order**: code exists, `active`, not expired (`qr_invalid`, `qr_used`, `qr_cancelled`, `qr_expired`) → idempotency key used ⇒ return original result → purpose collect (`wrong_qr_type`) → branch known/active, vendor active (`branch_required`) → customer not blocked (`user_blocked`) → active rule (`no_active_rule`), amount valid (`invalid_amount`), points > 0 (`no_points_earned`), receipt not reused (`duplicate_receipt`). A failed check changes nothing; the QR stays usable.
5. **One transaction:** upsert card → insert `point_events` (earn, +points, amount, rule, branch, staff, qr, idempotency_key) → `balance += p, lifetime_points += p, last_activity_at = now()` → `UPDATE qr_codes SET status='used', … WHERE id=$1 AND status='active' AND expires_at > now()` (0 rows ⇒ abort `qr_used`).
6. Staff app gets `{pointsAdded, …}`; customer app's poll sees `used` + result.

## Redeem flow

1. Customer picks a reward → `POST /api/app/qr-codes {purpose:"redeem", rewardId}` (server pre-checks reward active + balance, ties QR to vendor + reward).
2. Staff scan → preview shows "Redeem: <reward> · <cost> pts" → `POST /api/vendor/scans/redeem {code, branchId?, idempotencyKey}`.
3. Checks: code valid (as above), purpose redeem, QR vendor == staff vendor (`vendor_mismatch`), reward active (`reward_unavailable`), customer not blocked, balance (`insufficient_points`).
4. **One transaction:**
   ```sql
   UPDATE cards SET balance = balance - $cost
   WHERE id = $card AND balance >= $cost
   RETURNING balance;           -- no row ⇒ insufficient_points ⇒ abort
   ```
   + insert `point_events` (redeem, −cost) + insert `redemptions` (snapshot name/cost) + mark QR used (conditional, as above).
5. Both apps show "Reward approved: <reward>", branch, time.

## Fraud flags (write rows to `fraud_flags`; never block anything by themselves)

- `too_many_collects`: > 3 collects for one customer in a day at one vendor.
- `large_purchase`: receipt ≫ branch's usual size (e.g. > 5× 30-day average).
- `branch_spike`: branch daily points > 3× its 30-day average.
- `staff_spike`: one staff member's daily points > 3× their own average.

Run as a scheduled job.

---

## API endpoints

### Customer app — `/api/app` (Supabase access token, `CustomerAuthGuard`)
| Method | Path | Purpose |
|---|---|---|
| GET / PATCH | /users/me | Own profile / update name, email, phone, `gender` (`male`/`female`), `birthDate` (`YYYY-MM-DD`, not future; `null` clears either) — **built** |
| PUT / DELETE | /users/me/avatar | Upload or replace my photo (private bucket; old file deleted) / remove it (file deleted, provider photo cleared too) — **built** |
| GET | /cards | My cards: vendor, balance, lifetime, affordableRewards, nextReward — **built** |
| GET | /cards/{id}/events | History for one card (`?limit`) — **built** |
| GET | /vendors | Explore: active vendors A–Z (`?search` by name) with rule summary, active reward and open branch counts, first branch address, my balance — **built** |
| GET | /vendors/{id} | Shop page: active rule, active rewards (shop order), menu pages, open branches (address, lat/lng, photos), my card; suspended/unknown → 404 `vendor_not_found` — **built** (`vendors/app-vendors.controller.ts`, `vendor-page.service.ts`) |
| POST | /qr-codes | `{purpose:"collect"}` (no vendorId: works at any shop) → `{id, code, expiresAt}` — **built** (redeem purpose comes with the redeem flow) |
| GET | /qr-codes/{id} | Status + result once used (polled) — **built** |
| POST | /qr-codes/{id}/cancel | Customer closed the QR — **built** |

Dev test pages (not in production): `/dev/login.html` (customers), `/dev/staff.html` (staff sign-in, invite/reset landing page, staff CRUD), served from `apps/api/dev-public`. Don't add new dev pages unless asked.

**`me` convention:** a signed-in user's own record is always `<resource>/me` (`/api/app/users/me`, `/api/vendor/staff/me`): no id in the URL, so nobody can ask for someone else's. Never expose a customer list on `/api/app`.

Sign-in, refresh and account linking happen in the apps through the Supabase SDK — there are no `/auth/*` endpoints. Auth errors use stable codes: `missing_token`, `invalid_token`, `token_expired` (401); `provider_not_allowed`, `user_blocked` (403).

### Staff app + vendor dashboard — `/api/vendor` (Supabase access token, `StaffAuthGuard`, scoped to the staff's vendor)

`GET /staff/me` returns the staff row **plus** `vendor` {name, logoUrl, currency}, `branch`, `branches` (scannable: own branch, or all active for vendor_admin) and `activeRule` — everything the staff app needs after sign-in.

**Built:** `GET /profile` (any role: own vendor) · `PATCH /profile` (vendor_admin: name, logoUrl, contactEmail — never status/currency) · `PUT|DELETE /profile/logo` (vendor_admin; file deleted on replace/remove) · `GET /images?kind&branchId` (any role) · `POST /images` (multipart `file` + `kind` menu|branch_photo + `branchId?`; vendor_admin: menu + any branch; branch_manager: own branch photos only) · `DELETE /images/{id}` (204; file deleted) · `GET /staff/me` (any role) · `GET|POST /staff`, `GET|PATCH /staff/{id}` (vendor_admin + branch_manager). Rules: vendor_admin manages everyone in the vendor but not their own role/branch/status; branch_manager manages only `staff` in their own branch and can't change role/branch; `staff` role has no access to `/staff`. Other vendors' / branches' rows return 404. Disable = `PATCH {status:"disabled"}` (soft delete). Email can't change. Error codes: `not_staff`, `staff_disabled`, `vendor_suspended`, `branch_closed`, `forbidden_role`, `forbidden_branch`, `forbidden_role_change`, `cannot_modify_self` (403); `staff_not_found` (404); `branch_required`, `branch_not_allowed`, `invalid_branch` (400); `email_taken`, `account_already_staff` (409); `email_rate_limited` (429, Supabase's built-in sender allows only a few emails/hour); `auth_admin_not_configured`, `auth_provider_error` (503, with Supabase's message).

**Built — staff app (all staff roles):** `POST /scans/preview` (200, `{purpose, usable, reason, expiresAt}`, changes nothing) · `POST /scans/collect` (200; errors: `qr_invalid` 404, `qr_used`/`qr_expired`/`qr_cancelled`/`no_active_rule`/`duplicate_receipt`/`idempotency_key_reused` 409, `wrong_qr_type`/`branch_required`/`invalid_branch` 400, `forbidden_branch`/`user_blocked` 403, `no_points_earned` 422). Money math in `src/points/points.ts` (minor units), QR tokens in `src/qr-codes/qr-code.token.ts`.
**Planned — staff app:** `POST /scans/redeem` · `GET /scans/today`.
**Planned — dashboard:** `GET|POST|PATCH /branches` · `GET|POST /point-rules` (POST publishes a new version; vendor_admin) · `GET|POST|PATCH /rewards` (archive, never delete; vendor_admin) · `GET /summary?from&to` · `GET /events?branchId&from&to` · `GET /redemptions` · `GET /fraud/flags` (read-only). Vendors never see customer names/emails, only counts.

### Admin — `/api/admin` (Supabase access token with aal2, `PlatformAdminGuard`)

**Built:** `GET|POST /vendors`, `GET|PATCH /vendors/{id}` (filters `status`, `search`; PATCH `status:"suspended"` = soft delete; `logoUrl`/`contactEmail` accept null to clear; `currency` locked once the vendor has a point rule → 409 `currency_locked`; `vendor_not_found` 404) · `POST /vendors/{id}/admins` (invite a vendor_admin by email; same rules/errors as staff invites) · `PUT|DELETE /vendors/{id}/logo` (upload/replace/remove any vendor logo).

**Planned:**  `GET /vendors/{id}/summary` · `GET|PATCH /users/{id}` (support, block) · `POST /cards/{id}/adjust` (adjust ledger row with reason, balance in same tx) · `GET /fraud/flags` · `PATCH /fraud/flags/{id}` (dismiss/confirm, sets reviewed_by).

---

## NestJS modules

`auth`, `users`, `storage` (built: Supabase Storage + image processing), `vendor-images` (built), `vendors` (built: admin CRUD + logo), `branches`, `staff`, `point-rules`, `rewards`, `cards`, `qr-codes`, `scans` (collect + redeem), `redemptions`, `fraud-flags`, `admin`, `reports`.
`qr-codes` + `scans` are the core: build them with integration tests.

---

## Build order

1. `apps/api`: NestJS scaffold, Prisma baseline, health check. ✅
2. Customer auth (Google, Facebook; Apple postponed) + `GET|PATCH /api/app/users/me`. ✅
3. Staff auth + staff CRUD (`/api/vendor/staff`, `/staff/me`). ✅
   - Platform admin auth (aal2) + vendors CRUD (`/api/admin/vendors`). ✅
4. Vendor setup APIs: branches, point rules, rewards.
5. QR codes + collect flow + cards, with integration tests against a real Postgres. ✅ (`test/collect.e2e-spec.ts`)
6. Redeem flow.
7. Reports, admin APIs, fraud-flag job, then the React dashboard.
8. React Native customer app + staff app, using the shared `packages/api-client`.
   - Customer app: welcome (Google/Facebook/email sign-up + login, reset password), cards + history, You hub, profile details (photo via expo-image-picker → `PUT|DELETE /users/me/avatar`, name, phone, gender, birthday calendar), shop page `/shop/[id]` (rule, rewards with "pts to go", menu pages, branches with directions and photos), settings, about, collect QR screen (`/qr`: polls status every 2 s → "+N points" + balance; no push yet) ✅ (`apps/mobile`). Explore tab (all shops, search, opens the shop page). Placeholders: help/terms/join. Supabase Redirect URLs must allow `exp://**` and `dvote://**`.
   - Staff app (login → home → scan → bill amount → done) ✅ (`apps/staff`; types hand-written until api-client exists). The API needs `CORS_ORIGINS` for its web origin (`http://localhost:8081`).

## Must-have tests

- Collect happy path; points = floor(amount / spend) × per_spend (95 EGP @ 10 → 9); card created on first purchase; balance == ledger sum after every operation.
- Same idempotency key twice → points once, same response.
- QR single use: second scan → `qr_used`; expired → `qr_expired`; two concurrent scans of one QR → exactly one succeeds.
- A collect QR works at any vendor; points go to the scanning staff's vendor + branch (even for an old row that stored a vendor). `vendorId` on create → 400. Redeem QR at another vendor → `vendor_mismatch`.
- Below one point / below min purchase → `no_points_earned`, nothing written; duplicate receipt → `duplicate_receipt`.
- Redeem: 1000 − 300 = 700; insufficient balance rejected; two concurrent redeems on exactly-enough balance → exactly one succeeds; archived reward → `reward_unavailable`.
- New rule version applies only to later purchases; reward price change doesn't alter past redemptions.
- Blocked customer rejected; disabled staff rejected.
- Vendor A's staff can never read or act on vendor B's data.

## Conventions

- **Folder structure: by feature** (`src/<feature>/` with module, controller(s), service, `dto/`), not by layer. Logic lives in services; controllers stay thin.
- **DTO naming:** requests by action — `Create<X>Dto`, `Update<X>Dto`, `List<X>QueryDto` (files `create-x.dto.ts`, …); responses `<X>ResponseDto` (`x-response.dto.ts`) with a static `from(row)` mapper. API JSON is camelCase; DB columns stay snake_case.
- **UUIDs:** validate with `@IsUuid()` / `ParseUuidPipe` from `src/common/uuid.ts` (any 8-4-4-4-12 hex, like PostgreSQL), never class-validator `@IsUUID()` or Nest `ParseUUIDPipe`: those reject the hand-written seed ids (`11111111-0000-…`).
- TypeScript strict mode. DTOs validated with `class-validator`. All times stored UTC (`timestamptz`); convert with `branches.timezone` for display.
- **DB sessions are forced to UTC** (`PrismaService`: `options: '-c TimeZone=UTC'`). The pg adapter sends/reads timestamps without an offset; without this, Prisma-written times are shifted by the server's timezone (Africa/Cairo = 3 h) while DB `now()` defaults are not — e.g. a 5-minute QR would live 3 h. A collect e2e test guards it. Rows written before this fix (dev data) may have created_at 3 h early.
- Tests that must delete `point_events` (append-only) do it inside a transaction with `SET LOCAL session_replication_role = replica` — test cleanup only, never in app code.
- Balance-changing operations only inside `prisma.$transaction`, using conditional `UPDATE ... WHERE balance >= n` / `WHERE status = 'active'`, never read-modify-write in JS.
- Errors use stable `code`s: scans — `qr_invalid`, `qr_used`, `qr_expired`, `qr_cancelled`, `wrong_qr_type`, `vendor_mismatch`, `branch_required`, `no_active_rule`, `invalid_amount`, `no_points_earned`, `duplicate_receipt`, `reward_unavailable`, `insufficient_points`, `user_blocked`.
- Never commit `.env`, secrets or keys.

## Customer app localization (apps/mobile, built 2026-10-08)

- **English is the default; Arabic is the other language.** Chosen in Settings → Language, saved on the device (AsyncStorage `dvote.language`); not stored on the server yet.
- `src/i18n/`: `en.ts` is the source of every key; `ar.ts` is typed as the same `Dictionary`, so a missing Arabic text fails the typecheck. In components: `const { t } = useI18n(); t('cards.title')`; outside components (API errors, dialogs, dates) use the plain `t` export. Placeholders: `t('qr.expiresIn', { time })`. **Plurals**: objects `{ one, other }` (Arabic also `zero, two, few, many`) chosen by `count`. Lists (month/weekday names): `calendarNames()`. API error codes → `errors.<code>` (`friendlyMessage` in `lib/api.ts`).
- **Never hard-code user-facing text** in screens: add the key to `en.ts` and `ar.ts`.
- **Arabic = right-to-left without a restart:** `Screen`, the tab bar and the sheets set `direction: 'rtl'`; use `marginStart/End` (not Left/Right) for side spacing; directional icons use `<Icon … mirror />`; `TextInput` aligns to the reading side. Numbers stay in Western digits (0-9).
- **Fonts:** Inter for English, IBM Plex Sans Arabic for Arabic (`components/Text` picks by language; both loaded in `app/_layout`).
- **Shop data in Arabic:** rewards have optional `name_ar`/`description_ar`; the API returns both (`nameAr`, `descriptionAr`, `rewardNameAr`) and the app picks with `localized(en, ar)` (falls back to English). Not translated yet: vendor and branch names/addresses, Supabase emails, the staff app.

## Later (not v1)

Push notifications (FCM), point expiry, vendor-side void of a mistyped collect, vendor promotions (double points), offline QR, POS integration, Apple sign-in, vendor billing.
