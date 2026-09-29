# dvote — Coffee Loyalty Platform

NFC-based "buy N coffees, get 1 free" loyalty platform for coffee vendors.
Customers tap **Request a point** in the mobile app; the barista taps the branch's NFC card on the phone; the backend awards the point. Each vendor sets its own rule (e.g. Joy Corner: 10 points → 1 free coffee).

Three clients:

| Client | Users | Purpose |
|---|---|---|
| Mobile app (React Native + Expo, iOS + Android) | Customers | Sign in, request a point, see wallets/history, claim free coffee |
| Vendor dashboard (React, web) | Vendor admins, branch managers, staff | Own branches, staff, NFC cards, program rules, reports |
| Admin dashboard (React, web) | Platform admins | All vendors, onboarding, tags, fraud review, support |

Full spec: `docs/Coffee_Loyalty_Platform_Documentation_v1.2.pdf`. Database source of truth: `database/dvote_schema.sql`.

---

## Tech stack (decided)

- **Backend:** NestJS (TypeScript), Prisma ORM, PostgreSQL 18
- **Web dashboards:** React + TypeScript (Vite), Ant Design, TanStack Query, Recharts. One app, role-based routes for vendor and admin.
- **Mobile:** React Native + Expo (TypeScript), `react-native-nfc-manager` for NFC (NTAG 424 DNA SUN reads), `@supabase/supabase-js` for sign-in. NFC is a native module, so the app runs as an Expo **development build** (not Expo Go).
- **API contract:** OpenAPI generated from NestJS → one typed TypeScript client (`packages/api-client`) shared by the React dashboard and the React Native app. One language (TypeScript) across backend, web and mobile.
- **Auth: Supabase Auth (auth only — the database is NOT on Supabase).** Supabase issues and refreshes all tokens; NestJS only verifies them locally against the project's JWKS (`SUPABASE_URL/auth/v1/.well-known/jwks.json`, via `jose`) and maps the token's `sub` to our own rows. NestJS never issues JWTs.
- **Customer auth:** Google and Facebook sign-in through Supabase (NO phone/OTP, no email/password, no anonymous — the guard rejects other providers with `provider_not_allowed`). Supabase links providers with the same verified email into one auth user. `users.auth_user_id` = Supabase user id; the row is created on the customer's first API call.
  - **Apple is postponed** (needs the paid Apple Developer Program, $99/yr). To add it: enable it in Supabase and add `'apple'` to `CUSTOMER_PROVIDERS` in `auth/customer-auth.guard.ts`. An iOS App Store release that offers Google/Facebook login will likely need Sign in with Apple too (App Store guideline 4.8).
- **Staff / admin auth (decided, build in step 5):** also Supabase, email + password. Accounts are invite-only (created server-side), and our `staff_users` / `platform_admins` row decides the role. Platform admins use Supabase MFA (TOTP); require `aal2` in the token. This needs a migration adding `auth_user_id` to both tables and making `password_hash` nullable.
- **NFC tags:** NTAG 424 DNA with SUN from day one (signed, counter-based taps). Tag secret keys live in a secrets manager/KMS; DB stores only `key_ref`.
- **Hosting v1:** one backend container + one managed PostgreSQL. No microservices, queues or Redis.

## Repo layout (monorepo)

`apps/api` is self-contained (own `package.json`, lockfile, `node_modules`, `.env`); run Nest/Prisma commands from `apps/api` (Prisma config: `prisma7.config.ts`). `dashboard`, `mobile` and `api-client` are placeholders — not scaffolded yet. Root `package.json` only has `api:*` convenience scripts (no npm workspaces yet; add them when `api-client`/`dashboard` get a `package.json`).

```
dvote/
├── CLAUDE.md
├── docs/                      # PDF spec, ERD
├── database/
│   ├── dvote_schema.sql       # schema source of truth (13 tables)
│   └── dvote_seed_joy_corner.sql
├── apps/
│   ├── api/                   # NestJS + Prisma
│   ├── dashboard/             # React (vendor + admin)
│   └── mobile/                # React Native (Expo)
└── packages/
    └── api-client/            # generated TS client from OpenAPI
```

---

## Database

Local DB: `postgresql://postgres:<password>@localhost:5432/dvote` (put it in `apps/api/.env` as `DATABASE_URL`, never commit it). Prisma lives in `apps/api/prisma/`; migrations `0_init` (baseline) and `1_users_auth_user_id` are applied, and `database/dvote_schema.sql` includes both. The Prisma client is generated into `apps/api/src/generated/prisma` (git-ignored; import from `generated/prisma/client.js`).

The schema was created with raw SQL (`database/dvote_schema.sql`) and is already applied to the local `dvote` database. **Prisma must adopt it, not recreate it:**

1. `npx prisma db pull` → generates `schema.prisma` from the live DB.
2. Baseline: copy `dvote_schema.sql` to `prisma/migrations/0_init/migration.sql`, then `npx prisma migrate resolve --applied 0_init`.
3. Future changes: hand-write `prisma/migrations/<n>_<name>/migration.sql` (idempotent where possible), update `schema.prisma` to match, apply with `npx prisma migrate deploy`, run `npx prisma generate`, and mirror the change in `database/dvote_schema.sql`. Avoid `migrate dev` on the local DB: drift from objects Prisma can't model can make it offer a reset, which wipes the seed data. Prisma cannot express the partial unique indexes, CHECK constraints or triggers below, so **never let a Prisma migration drop them**.

### Tables (13)

| Table | Side | Purpose |
|---|---|---|
| `vendors` | vendor | Brand (tenant root). status: active/suspended |
| `branches` | vendor | Physical shop. FK vendor |
| `staff_users` | vendor | role: vendor_admin (branch_id NULL) / branch_manager / staff (branch_id required) |
| `nfc_tags` | vendor | NTAG 424 card per branch. `tag_uid` unique, `key_ref`, `last_counter` |
| `programs` | vendor | Reward rules ("settings"): `points_required`, `reward_description`, `cooldown_minutes`, `version`, `is_active` |
| `users` | customer | Customers. email nullable (a provider may not share it), phone optional |
| `user_identities` | customer | (provider, provider_user_id) unique → user. **Currently unused:** Supabase handles provider identities and linking |
| `wallets` | customer | One per (user, vendor). `balance` (cached), `lifetime_points`, `program_id` |
| `scan_sessions` | activity | One per button press. mode earn/redeem, status open/consumed/expired/rejected, expires in 90 s |
| `point_events` | activity | **Ledger, append-only.** type earn(+1)/redeem(−N)/adjust(±, admin + reason) |
| `redemptions` | activity | One per free coffee, 1-to-1 with its redeem ledger row |
| `platform_admins` | platform | Internal team. 2FA via `totp_secret_ref` |
| `fraud_flags` | platform | Suspicious activity for review. status open/dismissed/confirmed |

All tables: `id uuid` (gen_random_uuid), `created_at`, `updated_at` (trigger-maintained, timestamptz UTC). Soft delete via `status`; never hard-delete business rows.

### Constraints enforced by the DB (keep them; handle their errors in the API)

- One active program per vendor (partial unique index); `UNIQUE (vendor_id, version)`.
- `wallets`: `UNIQUE (user_id, vendor_id)`, `balance >= 0`; wallet's program must belong to wallet's vendor (composite FK).
- `staff_users`: branch must belong to the same vendor (composite FK); role/branch rule (CHECK).
- `point_events`: earn ⇒ delta = 1 and session_id set; redeem ⇒ delta < 0 and session_id set; adjust ⇒ created_by + reason set. `idempotency_key` UNIQUE. At most one event per session.
- `point_events` UPDATE/DELETE raise an exception (trigger). Corrections = new `adjust` row.
- `scan_sessions`: redeem ⇒ vendor_id required; rejected ⇒ reject_reason required.
- `fraud_flags`: at least one target (vendor/branch/user/tag); non-open ⇒ reviewed_by set.

---

## Core business rules (invariants)

1. **Points live at vendor level.** Earned at a branch, stored in the user's wallet for that vendor. Never move between vendors.
2. **The server decides points, never the app.** The app only forwards the NFC payload.
3. **1 tap = 1 point.** Cooldown: max 1 earn per wallet per branch per `cooldown_minutes` (default 10).
4. **Ledger is the source of truth.** `wallets.balance` must always equal `SUM(point_events.delta)` for that wallet. Every balance change happens in the same DB transaction as its ledger insert.
5. **Customer claims the reward** with a "Claim free coffee" button (not automatic). Extra points carry over (11 − 10 = 1).
6. **Program versioning.** When a vendor changes rules, insert a new `programs` row (version + 1) and make it active. Existing wallets keep their old program until they redeem; the redeem transaction moves the wallet to the active program.
7. **Tenant scoping.** Every vendor-dashboard query filters by the staff token's `vendor_id` (and `branch_id` for branch roles). Enforce once, in a NestJS guard/interceptor — never per endpoint by memory.

---

## Earn flow (`mode=earn`)

1. App: `POST /api/app/scan-sessions {mode:"earn"}` → server inserts open session (expires_at = now + 90 s), returns `session_id`.
2. App enters NFC reader mode; barista taps card; app reads SUN payload (UID, counter, CMAC).
3. App: `POST /api/app/scan-sessions/{id}/complete {payload, idempotencyKey}`.
4. Server checks **in order** (any failure → session `rejected` + `reject_reason`, clear error to app):
   1. Session exists, belongs to this user, status open, not expired.
   2. `idempotencyKey` already used → return the original result, award nothing.
   3. Tag exists by UID and is `active`; resolve branch → vendor.
   4. CMAC valid and counter > `nfc_tags.last_counter` (`bad_signature`, `replayed_counter`).
   5. User not blocked; vendor and branch active.
   6. Cooldown: no earn for this wallet at this branch within `cooldown_minutes` (`cooldown`).
5. **One transaction** (`prisma.$transaction`):
   - Upsert wallet (on first visit, `program_id` = vendor's active program).
   - Insert `point_events` (type earn, delta +1, branch, session, tag, idempotency_key).
   - `UPDATE wallets SET balance = balance + 1, lifetime_points = lifetime_points + 1`.
   - `UPDATE nfc_tags SET last_counter = <counter>`.
   - Session → `consumed`, set `tag_id`.
6. Respond: new balance, points_required, remaining.

## Redeem flow (`mode=redeem`)

1. App shows **Claim free coffee** when `balance >= points_required` (of the wallet's program).
2. `POST /scan-sessions {mode:"redeem", vendorId}` → session with `vendor_id`.
3. Barista taps; app calls `/complete` as above.
4. Same checks except cooldown, plus: tag's vendor == session's vendor; balance still sufficient.
5. **One transaction:**
   ```sql
   UPDATE wallets SET balance = balance - $n
   WHERE id = $wallet AND balance >= $n
   RETURNING balance;           -- no row ⇒ not enough points ⇒ abort
   ```
   - Insert `point_events` (type redeem, delta = −n).
   - Insert `redemptions` (wallet, program, branch, point_event_id).
   - If the vendor has a newer active program, set `wallets.program_id` to it.
   - Session → `consumed`.
6. Respond with a confirmation screen ("Free coffee approved", branch, time) for staff to see.

## Fraud flags (write rows to `fraud_flags`; never block a tap by themselves)

- `too_many_earns`: > 3 earns for one user in a day across one vendor's branches.
- `branch_spike`: branch daily points > 3× its 30-day average.
- `tag_counter_anomaly`: counter goes backwards or skips a large range.
- `far_location`: tap location far from the tag's branch (if location is sent).

Run the batch rules as a scheduled job; the counter anomaly can be flagged inline in the scan flow.

---

## API endpoints

### Mobile — `/api/app` (Supabase access token, `CustomerAuthGuard`)
| Method | Path | Purpose |
|---|---|---|
| GET / PATCH | /me | Profile / update name, email, phone |
| GET | /wallets | All wallets: vendor, balance, points_required, remaining |
| GET | /wallets/{id}/events | History for one vendor |
| GET | /vendors | Vendors + branches (discovery, map) |
| POST | /scan-sessions | Open session `{mode, vendorId?}` |
| POST | /scan-sessions/{id}/complete | `{payload, idempotencyKey}` → result + new balance |

Sign-in, refresh and account linking happen in the app through the Supabase SDK — there are no `/auth/*` endpoints. Auth errors use stable codes: `missing_token`, `invalid_token`, `token_expired` (401); `provider_not_allowed`, `user_blocked` (403).

### Vendor — `/api/vendor` (staff JWT, always scoped to staff's vendor)
`GET /summary?from&to` · `GET|POST|PATCH /branches` · `GET /events?branch_id&from&to` · `GET /redemptions` · `GET|POST|PATCH /staff` · `GET|POST /programs` (POST publishes a new version) · `POST /tags/{id}/report-lost` · `GET /fraud/flags` (own branches, read-only). Vendors never see customer names/emails, only counts.

### Admin — `/api/admin` (platform admin JWT + 2FA)
`GET|POST|PATCH /vendors` · `GET /vendors/{id}/summary` · `POST /tags` · `PATCH /tags/{id}` (revoke/reassign) · `GET /users/{id}` · `POST /wallets/{id}/adjust` (writes an `adjust` ledger row with reason, updates balance in same tx) · `GET /fraud/flags` · `PATCH /fraud/flags/{id}` (dismiss/confirm, sets reviewed_by).

---

## NestJS modules

`auth`, `users`, `vendors`, `branches`, `staff`, `nfc-tags`, `programs`, `wallets`, `scan-sessions`, `redemptions`, `fraud-flags`, `admin`, `reports`.
`scan-sessions` is the core: build it first, with tests.

## NTAG 424 DNA verification

Node `crypto` has AES but no CMAC. Use a well-tested CMAC package or implement RFC 4493 on AES-CBC. Test against the sample vectors in NXP application note **AN12196** before trusting it. Keys are fetched from the secrets store via `key_ref`; never log or persist raw keys.

---

## Build order

1. `apps/api`: NestJS scaffold, Prisma `db pull` + baseline, seed (Joy Corner), health check. ✅
2. Customer auth (Google, Facebook; Apple postponed) via Supabase + `GET|PATCH /api/app/me`. ✅ backend done.
3. Scan sessions + earn flow + wallets, with integration tests against a real Postgres.
4. Redemption flow.
5. Vendor and admin APIs, fraud-flag job, then the React dashboards.
6. React Native (Expo) app, using the shared `packages/api-client`.

## Must-have tests

- Earn happy path; balance == ledger sum after every operation.
- Same idempotency key twice → one point, same response.
- Cooldown rejects the second tap within the window.
- Replayed/old NFC counter and bad CMAC are rejected.
- Two concurrent redeems on a wallet with exactly N points → exactly one succeeds.
- Redeem at 11/10 leaves balance 1; wallet moves to newer program version after redeem.
- Revoked/lost tag rejected; blocked user rejected.
- Vendor A's staff can never read vendor B's data.

## Conventions

- TypeScript strict mode. DTOs validated with `class-validator`. All times stored UTC (`timestamptz`); convert with `branches.timezone` for display.
- Money-like operations only inside `prisma.$transaction`, using conditional `UPDATE ... WHERE balance >= n` (or `SELECT ... FOR UPDATE`), never read-modify-write in JS.
- Errors returned to the app use stable codes matching `reject_reason` (`cooldown`, `tag_revoked`, `bad_signature`, `replayed_counter`, `session_expired`, `insufficient_points`, `vendor_mismatch`, `user_blocked`).
- Never commit `.env`, secrets or tag keys.

## Open decision

Cooldown scope: 10 minutes **per branch** (current default) or **per vendor**? Ask before changing.

## Later (not v1)

Push notifications (FCM), point expiry, staff confirmation app / quantity, QR fallback for phones without NFC, vendor promotions, vendor billing.
