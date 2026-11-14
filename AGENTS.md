# dvote — repository guide for coding agents

Spend-based loyalty for coffee shops and hospitality businesses in Egypt. Each merchant ("vendor" in code, API and database; "merchant" in every UI text) sets a **point rule** (e.g. every EGP 10 = 1 point) and a **reward catalogue** priced in points. Customers join from a web page (NFC tag or QR at the till), get a **Google Wallet** card (Apple Wallet is pending), and cashiers scan that card to collect points or give a reward. The backend decides and records everything.

**Read first:**
- [`DVOTE_BRIEF.md`](DVOTE_BRIEF.md): product direction, decisions and the latest handoff. Keep it updated.
- [`CLAUDE.md`](CLAUDE.md): the full implementation reference (every endpoint, migration, error code and decision). This file is the short version; when they differ, `CLAUDE.md` and the current source win.
- [`DEPLOY.md`](DEPLOY.md): addresses, hosting and go-live steps.
- [`docs/brand/dvote-brand-guidelines.md`](docs/brand/dvote-brand-guidelines.md): brand v3.0.

Database source of truth: `database/dvote_schema.sql`. Original spec: `docs/Coffee_Loyalty_Platform_Documentation.pdf` (v2.0; the customer-app flows in it are out of date).

---

## Apps and addresses

| App | Address | Code | Notes |
|---|---|---|---|
| Landing page | `dvote.co` | `apps/landing` (port 5175) | One page: plans from `GET /api/public/plans`, pricing calculator, Founding counter, "Start free trial". Arabic default. |
| Merchant dashboard | `merchant.dvote.co` | `apps/dashboard` (port 5173) | Merchant admins, branch managers, viewers; cashiers get only the **Scan** page. Self sign-up at `/signup`, phone pairing at `/pair`. |
| Admin dashboard | `admin.dvote.co` | same `apps/dashboard` build | dvote team only (MFA). Admin pages stay English. |
| Customer storefront | `m.dvote.co/<slug>` | `apps/web` (port 5174) | Venue hub, join, card page with Wallet buttons, menu, branches, Wi-Fi, feedback, privacy, terms. Talks only to `/api/public/*`. |
| API | `api.dvote.co` | `apps/api` (port 3000) | NestJS + Prisma. The only thing that touches the database and Storage. |
| Staff app | — | `apps/staff` | Expo, **parked 2026-11-05**: the Scan page (laptop or a paired phone) is the launch scanner. Code stays. See `apps/staff/AGENTS.md` if you touch it. |
| Customer app | — | archived at git tag `customer-app-v1` | Paused 2026-10-17 for Wallet passes. The `/api/app/*` endpoints and their tests stay and must keep passing. |
| Holding page | — | `apps/coming-soon` | Old, replaced by `apps/landing`. |
| UI tests | — | `apps/ui-tests` | Playwright against mocked API/auth: every page, roles, dialogs, 9 viewports, Arabic RTL, dark mode. |

`develop` = integration, `main` = live (Cloudflare rebuilds the sites on merge; `main` is protected). Each app has its own `package.json`, lockfile, `node_modules` and `.env`; there are no npm workspaces. Root `package.json` has convenience scripts (`api:*`, `dashboard:*`, `web:*`, `landing:*`, `staff:*`, `ui:*`, `admin:create`, `storage:setup`, `db:backup`).

## Tech stack

- **Backend:** NestJS 12, Prisma 7, PostgreSQL (Supabase Postgres 17 in the cloud; local PostgreSQL for e2e tests only). Run Nest/Prisma commands from `apps/api` (Prisma config `prisma7.config.ts`).
- **Web:** React 19, TypeScript, Vite, Tailwind CSS v4, React Router 7. Dashboard adds shadcn/ui (Radix), TanStack Query, Recharts, Sonner, MapLibre (branch maps) and Solar icons.
- **Auth:** Supabase Auth issues all tokens; NestJS only verifies them against the project's JWKS (`jose`) and maps `sub` to its own rows. Guards: `StaffAuthGuard` (merchant staff, builds the `StaffContext`), `PlatformAdminGuard` (aal2 MFA required), `ScannerSessionGuard` (paired phones), `CustomerAuthGuard` (archived app).
- **Wallet:** Google Wallet (`src/wallet/`): one class per merchant, one object per card, synced after every balance or branding change. Apple Wallet is not built.
- **Hosting:** Cloudflare Workers static assets for the web apps; one API container (in-memory rate limits, live notices and background jobs, so **keep one instance**). API host still to decide.

## Plans, trial and billing

- Self sign-up (`POST /api/public/merchant-signup`, Cloudflare Turnstile) → email confirmation → `POST /api/vendor/signup` opens the shop on a **14-day trial** with everything. Ended trials lock (`trial_ended`); unpaid trial shops are deleted 30 days after sign-up.
- Plans **Regular / Loyal / Chain**: one price list in `apps/api/src/plans/plans.ts` (the landing keeps a fallback copy). Features and limits in `apps/api/src/plans/entitlements.ts`, mirrored in `apps/dashboard/src/lib/entitlements.ts`: **keep them identical**. Enforce in vendor controllers with `EntitlementsService` (`require` → 403 `plan_required`, `checkLimit` → 409 `plan_limit`). Moving down a plan never deletes or switches anything off. The dvote team (`ctx.adminId`, `/api/admin`) is never limited.
- Billing: `paid_until` set by the admin (no Paymob yet), upgrades apply at once, downgrades and cycle switches at renewal, 7 days' grace, then `subscription_expired`. Founding Merchants: 30% off for 6 months, spots set by the admin.

## Phone scanner pairing

Scan page → Pair a phone → QR + 6-digit code → the phone gets a 12-hour `dvs_` session token that **only** works on the scan routes and `/api/vendor/scanner/me`. Staff disabled, role changed or branch moved **ends** the session: **any new code that changes a staff member's status, role or branch must call `revokeForStaffChange`** in the same transaction. Shop or branch locks only pause it. Design: `docs/superpowers/specs/2026-11-05-phone-scanner-pairing-design.md`.

---

## Database

- **Cloud:** Supabase Postgres via the **Transaction pooler** (port 6543; the API pool is capped at 5). `prisma7.config.ts` switches to the session port for the Prisma CLI. Never commit `DATABASE_URL`.
- **Local:** `TEST_DATABASE_URL`, used only by e2e tests; `test/setup-env.ts` refuses any non-local host. Apply every migration to both.
- **Supabase Data API is locked:** `database/supabase_lockdown.sql` (RLS on every table, no policies, no grants to `anon` / `authenticated`). **Re-run it after any migration that adds a table.**
- **Schema changes:** hand-write `apps/api/prisma/migrations/<n>_<name>/migration.sql` (latest: `34_scanner_pairings`), apply with `npx prisma migrate deploy`, refresh with **`npm run db:pull`** (never plain `prisma db pull`: the fix-up script keeps partial unique indexes from becoming wrong relations), and mirror the change in `database/dvote_schema.sql`. Don't use `migrate dev` (it can offer a reset that wipes data). Prisma can't express the partial unique indexes, CHECKs, composite FKs and triggers: **never let a migration drop them.**
- The Prisma client is generated into `apps/api/src/generated/prisma` (git-ignored).
- **Storage:** apps never upload to Supabase Storage directly. They send `multipart/form-data` to the API, which re-encodes to WebP with `sharp` and uploads with the secret key. File names are random and never reused.

## Core business rules (invariants)

1. **Points live on the customer's card for one merchant.** Earned at any of its branches; never move between merchants. Composite FKs `(…, vendor_id)` enforce this in the database.
2. **The server decides points, never a client.** Scanners send only the code and the receipt total.
3. **Points formula:** `floor(amount / spend_amount) * points_per_spend`, capped at `max_points_per_purchase`, 0 below `min_purchase`. Money is `numeric(12,2)` in the DB and integer minor units in code, never floats. 0 points ⇒ `no_points_earned`, nothing written.
4. **The ledger (`point_events`) is the source of truth and append-only** (a trigger blocks UPDATE/DELETE). `cards.balance` always equals `SUM(delta)`; every balance change happens in the same transaction as its ledger row. Corrections are new `adjust` rows.
5. **A card is created when the customer joins a merchant** (balance 0). The **mobile number is the customer key** (Egyptian mobiles only, stored `+201XXXXXXXXX`).
6. **Customers choose when to redeem;** leftover points stay (1,000 − 300 = 700).
7. **Versioning:** a new rule is a new `point_rules` row; past earns keep their `rule_id`. Redemptions snapshot the reward name and cost. Archived or sold-out rewards can't be redeemed.
8. **QR codes:** Wallet card QRs `dvote:c1:<secret>` are reusable and merchant-scoped (only the SHA-256 is stored; the secret derives from `WALLET_TOKEN_SECRET`, **never change it once passes exist**). The archived app's `dvote:q1:` codes are one-time, 5 minutes. Never put a user id in a QR.
9. **Merchant and branch come from the scanning staff member** (or the paired phone's branch), never from the customer.
10. **Tenant scoping:** every vendor-side query filters by the `StaffContext` built once in the guard. Other merchants' rows → 404.
11. **Balance changes use conditional SQL** inside `prisma.$transaction` (`UPDATE … WHERE balance >= n`, `WHERE status = 'active'`), never read-modify-write in JS. Collect and redeem use idempotency keys; Google Wallet sync happens after commit and never undoes points.

## Conventions

- **Feature folders** (`src/<feature>/` with module, controller, service, `dto/`); thin controllers. DTOs: `Create<X>Dto`, `Update<X>Dto`, `List<X>QueryDto`, `<X>ResponseDto.from(row)`. API JSON camelCase, DB snake_case. Kebab-case file names in new web code.
- **UUIDs:** `@IsUuid()` / `ParseUuidPipe` from `src/common/uuid.ts`, never class-validator `@IsUUID()` or Nest `ParseUUIDPipe` (they reject the seed ids).
- **Time:** all `timestamptz` UTC; DB sessions are forced to UTC in `PrismaService`. Reports use Cairo days (`src/reports/cairo-days.ts`, `@IsDay()`).
- **Errors:** stable `code`s (e.g. `qr_invalid`, `insufficient_points`, `plan_required`, `trial_ended`, `pairing_invalid`); the dashboard maps them to `errors.<code>` in both languages.
- **The `me` convention:** a user's own record is `<resource>/me`, never an id in the URL.
- **Localization:** never hard-code user-facing text. `en.ts` holds every key, `ar.ts` is typed against it (a missing Arabic string fails the typecheck). **Arabic is the default** on the dashboard and landing page. Use logical classes (`ps/pe/ms/me/start/end/text-start/text-end`), mirror directional icons with `rtl:rotate-180`, Western digits. Egyptian Arabic in marketing copy.
- **Brand v3.0:** dvote Blue `#1F3DFF` is an accent in the product (main action, active/selected, links, focus, lead chart series), never sidebars or large panels. Brand fills use `text-brand-foreground`. Tokens keep their v1 names; values live in each app's `styles.css` (dashboard is the source of truth). DM Sans (Latin) and Alexandria (Arabic).
- **Dashboard icons:** `@solar-icons/react/linear` everywhere, the identical export from `@solar-icons/react/bold-duotone` for active navigation. Convert shadcn-generated icon imports to Solar. Keep `public/icon-credits.txt`.
- **Shared lists kept identical across apps:** card designs, card look (`lib/card-look.ts` in dashboard and web), storefront section types, entitlements, cities.
- **Shared merchant screens** use `useVendorApi()` / `useMe()` / `useMyScope()` and `WorkspaceLink`, so the same component works for a merchant (`/api/vendor`) and for the dvote team's merchant workspace (`/api/admin/vendors/:id/workspace/...`).
- Tests that must delete ledger rows do it in a transaction with `SET LOCAL session_replication_role = replica`, test cleanup only.
- Never commit `.env`, keys or secrets. Only public values go in `VITE_*` / `EXPO_PUBLIC_*`.

## Verification

| What | Command (repo root) |
|---|---|
| API unit / e2e / lint / build | `npm run api:test`, `npm run api:test:e2e`, `npm run api:lint`, `npm run api:build` |
| Dashboard | `npm --prefix apps/dashboard run typecheck`, `… run build` |
| Customer website | `npm --prefix apps/web run typecheck`, `… run build` |
| Landing page | `npm --prefix apps/landing run build` |
| Responsive UI tests | `npm run ui:install` once, then `npm run ui:test` |

Add new dashboard/web pages to the UI-test specs and new endpoints to `apps/ui-tests/lib/mock-api.ts`. Update `DVOTE_BRIEF.md`, `CLAUDE.md` and the README when behaviour changes.

## Not built yet

Apple Wallet passes and notifications, Paymob payments, Turnstile on the customer join form, the generated API client (`packages/api-client`), a vendor read-only fraud view, point expiry, POS integration.
