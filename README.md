<p align="center">
  <img src="apps/coming-soon/logo.svg" alt="dvote" width="240" />
</p>

<h1 align="center">Turn everyday visits into lasting loyalty.</h1>

<p align="center">
  Digital loyalty cards, meaningful rewards, and the tools to bring customers back.<br />
  Built for coffee shops and hospitality businesses in Egypt.
</p>

<p align="center">
  <a href="#what-is-dvote">About</a> ·
  <a href="#the-platform">The platform</a> ·
  <a href="#features">Features</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#documentation">Documentation</a>
</p>

---

## What is dvote?

**dvote helps merchants turn a purchase into a reason to return.** It brings a merchant's storefront, loyalty programme, customer relationships, and day-to-day operations into one platform.

Customers tap an NFC tag or scan a QR code, open the merchant's page, and get a digital loyalty card without installing an app. At the counter, staff scan the card to add purchase points or redeem a reward. Merchants set their own earning rules, design their cards, manage branches and teams, and understand what brings customers back.

Each merchant has its own programme. A customer's points work across that merchant's branches and stay separate from every other merchant's balance.

### From first tap to next reward

1. **Discover and join.** Open the merchant's storefront from a link, NFC tag, or printed QR. Enter a name and Egyptian mobile number, with age confirmation, to create or recover a card. The current public flow requires no email, password, or OTP.
2. **Keep the card handy.** View it on the web or save it to Google Wallet when the integration is configured.
3. **Earn on a purchase.** Staff scan the card and enter the receipt total. The API calculates the points and records the transaction.
4. **Enjoy a reward.** Staff scan the card, select an available reward, and confirm redemption. The server checks the balance and deducts the cost.
5. **Come back for more.** The balance updates, while merchants can use customer segments, Wallet messages, and insights to support repeat visits.

For example, a merchant offering **1 point for every EGP 10 spent** awards **9 points on an EGP 95 purchase**. Redeeming a 300-point coffee from a 1,000-point balance leaves 700 points for the next visit.

## The platform

| Application | Address | Who it serves | What it does |
| --- | --- | --- | --- |
| **Landing page** | `dvote.co` | Prospective merchants | One-page site with plans, a pricing calculator, the Founding Merchants counter, a demo phone, and "Start free trial". Egyptian Arabic and English. |
| **Merchant dashboard** | `merchant.dvote.co` | Merchant admins, branch managers, viewers, and cashiers | Self sign-up and free trial, storefront, loyalty card, rewards, branches, team, customers, activity, insights, Broadcast, Billing, and the **Scan** page, subject to role and plan. |
| **Platform admin dashboard** | `admin.dvote.co` | The dvote team | Merchant onboarding, plan activation and renewals, Founding spots, platform customers, statistics, fraud review, feedback, system status, and merchant workspaces. Same build as the merchant dashboard. |
| **Customer website** | `m.dvote.co/<shop>` | Customers | Merchant storefronts, joining and recovering cards, the card page, Wallet links, menu, branches, Wi-Fi, and feedback. |
| **Phone scanner** | `merchant.dvote.co/pair` | Cashiers | A phone paired from the Scan page with a QR and 6-digit code, then used as the till scanner for 12 hours. No app install. |
| **API** | `api.dvote.co` | All active applications | Business rules, identity checks, tenant boundaries, points, rewards, plans and billing, storage, reporting, and Wallet integrations. |

**Current direction:** customer web and Wallet cards are the customer experience, and the dashboard Scan page (on a laptop or a paired phone) is the launch scanner. The Expo staff app in `apps/staff` is parked: the code stays, it does not ship at launch. The earlier Expo customer app is archived at the Git tag `customer-app-v1`. `apps/coming-soon` is the old holding page, replaced by `apps/landing`.

## Features

### Loyalty that belongs to the merchant

- Spend-based earning rules with purchase minimums and optional point caps.
- Branded card design, previews, version publishing, and card lifecycle controls.
- Reward catalogues with photos, point costs, optional retail values, and English/Arabic descriptions.
- Branch-level sold-out controls and redemption history.
- A dashboard Scan page for collecting points and giving rewards, by camera, typed code, or hand scanner.
- **Pair a phone:** a cashier's phone becomes a scanner for one branch in seconds; sessions end on disconnect, after 12 hours, or when the staff member is disabled or moved.

### A storefront customers can open anywhere

- Shareable merchant pages with branding, menu images, rewards, branch details, and maps.
- Card creation and recovery using a normalized Egyptian mobile number.
- QR and NFC entry links that retain source and branch attribution.
- Google Wallet pass creation and balance/branding sync after changes.
- Customer-to-merchant feedback from the public website.
- English and Arabic experiences, including right-to-left layouts.

### Plans, trial, and billing

- Self sign-up with Cloudflare Turnstile and email confirmation, then a **14-day free trial** with every feature.
- Three plans priced per branch: **Regular**, **Loyal**, and **Chain** (EGP 499 / 999 / 1,999 a month including the first branch; annual = 10 months). Prices live in one list, `apps/api/src/plans/plans.ts`.
- **Founding Merchants:** the first shops (10 by default, set by the dvote team) get 30% off for 6 months; the landing page shows the spots left.
- Plan gating: locked features stay visible with a lock and "See plans"; moving down a plan never deletes anything.
- Settings → **Billing** for merchant admins: current plan, price breakdown, upgrades (instant) and downgrades (at renewal), a 7-day grace period, then a renewal screen.
- Payments are collected outside the product for now and recorded by the dvote team; Paymob is not built yet.

### Tools for running and growing the business

- Merchant setup checklist, operational summaries, and attention items.
- Branch management, locations, photos, and pause/resume controls.
- Team invitations and role-based merchant/branch access.
- Customer lists, built-in and custom segments, and CSV export.
- Ledger activity, redemption reports, reward performance, and customer patterns.
- Broadcast messages with audience previews, draft autosave and recovery, scheduling, and repeating campaigns.
- Nearby reminder settings for selected geolocated branches; Google Wallet controls whether and when reminders appear.
- Platform-wide listings, merchant workspaces, and admin action logs.
- Responsive dashboard layouts with light/dark themes. **Arabic is the default language** on the dashboard and landing page, with English one tap away.

### Status and integration boundaries

| Area | Current state |
| --- | --- |
| Google Wallet | Implemented; pass issuance, updates, and messages need issuer credentials and server configuration. Provider acceptance does not prove device delivery or an open. |
| Apple Wallet | Planned. UI previews and entry points exist, but Apple passes and notification delivery are not implemented. |
| Payments | Not built. Merchants pay outside the product (WhatsApp); a platform admin activates or renews the plan. Paymob is planned. |
| Phone scanner pairing | Implemented; production needs migration `34_scanner_pairings` and a re-run of `database/supabase_lockdown.sql` before the API that uses it. |
| Join-form captcha | Turnstile protects merchant sign-up; the customer join form is not protected yet (rate limited per IP). |
| Staff app (Expo) | Parked on 2026-11-05. Cashiers use the Scan page or a paired phone. |
| Native customer app | Archived at `customer-app-v1`; the customer journey starts on the web. |
| Generated API client | Reserved in `packages/api-client`; not generated yet. Active apps maintain their own API types. |
| Hosting | Websites and dashboards on Cloudflare Workers; the API host (Railway or Hetzner) is still to decide. See [DEPLOY.md](DEPLOY.md). |

Deployment status can differ from source availability. Check [DEPLOY.md](DEPLOY.md) and the latest notes in [DVOTE_BRIEF.md](DVOTE_BRIEF.md) before releasing new features.

## Architecture

```mermaid
flowchart TD
    Landing[Landing page] --> API[NestJS API]
    Customer[Customer website] --> API
    Dashboard[Merchant and admin dashboard] --> API
    Phone[Paired phone scanner] --> API
    Dashboard --> Auth[Supabase Auth]
    API --> Auth
    API --> Prisma[Prisma]
    Prisma --> DB[(PostgreSQL)]
    API --> Storage[Supabase Storage]
    API --> Wallet[Google Wallet]
    API --> Turnstile[Cloudflare Turnstile]
```

The API owns business data and balance changes. Clients use Supabase for authentication where required and call the API for application data. They do not query the database or upload directly to Storage. A paired phone uses a short-lived scanner session token that only works on the scan routes.

### Stack

| Layer | Technology |
| --- | --- |
| Dashboard | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui + Radix, TanStack Query, React Router, Recharts, Solar icons |
| Customer website and landing page | React 19, TypeScript, Vite, Tailwind CSS v4, React Router |
| Staff app (parked) | React Native, Expo SDK 57, Expo Router, Expo Camera |
| Backend | NestJS 12, TypeScript, Prisma 7, PostgreSQL |
| Managed services | Supabase Auth, Postgres, and Storage; Google Wallet; Cloudflare Workers and Turnstile |
| Verification | Jest, Supertest, PostgreSQL integration tests, and Playwright |

### Transaction guarantees

- **The server decides points.** Money calculations use integer minor units, with points rounded down.
- **Every balance change has a ledger entry.** The append-only ledger and cached card balance update in one database transaction.
- **Retries do not award points twice.** Collect and redeem operations use idempotency keys and transactional checks.
- **Merchant boundaries are enforced.** Identity and role determine tenant/branch scope; points never move between merchants.
- **QR types have different lifetimes.** Saved Wallet cards use reusable, merchant-scoped card QRs. The original app flow uses expiring, single-use QRs. Both are validated by the API.
- **Redemption is checked again at confirmation.** Balance, merchant, branch, reward availability, and expected price are validated before points are deducted.

## Repository structure

```text
dvote/
├── apps/
│   ├── api/                 # NestJS API, Prisma schema/migrations, integration tests
│   ├── dashboard/           # Merchant + platform admin dashboard, Scan page, phone pairing
│   ├── web/                 # Customer storefront, joining, cards, and feedback
│   ├── landing/             # dvote.co: plans, pricing calculator, sign-up entry
│   ├── staff/               # Expo staff scanner (parked)
│   ├── coming-soon/         # Old static holding page (replaced by landing/)
│   └── ui-tests/            # Playwright checks with mocked API/auth
├── packages/
│   └── api-client/          # Placeholder for a generated OpenAPI client
├── database/               # SQL schema, development seed, and access lockdown
├── docs/                   # Spec, brand guide, billing spec, design specs, email templates
├── DVOTE_BRIEF.md           # Product direction, decisions, and current handoff
├── DEPLOY.md               # Addresses, hosting, and go-live steps
├── CLAUDE.md               # Detailed implementation notes
├── AGENTS.md               # Repository guidance for Codex
└── package.json            # Convenience scripts for individual applications
```

Applications have their own dependencies, lockfiles, and environment files. This repository does not currently use npm workspaces; a root install does not install every app.

## Getting started

### Prerequisites

- **Node.js 24** and npm, matching the API container runtime.
- A configured **Supabase project** for authentication, PostgreSQL, and image storage.
- A database with the repository's migrations applied.
- A separate **local PostgreSQL database** for API integration tests.
- Optional: a Google Wallet issuer account for Wallet features, and Cloudflare Turnstile test keys for the sign-up captcha.

### 1. Install the applications

From the repository root:

```bash
npm run api:install
npm run dashboard:install
npm run web:install
npm run landing:install
```

The parked staff app installs with `npm run staff:install` if you need it.

### 2. Configure the environment

```bash
cp apps/api/.env.example apps/api/.env
cp apps/dashboard/.env.example apps/dashboard/.env
cp apps/web/.env.example apps/web/.env
cp apps/landing/.env.example apps/landing/.env
```

Fill in each file using its example as a reference:

| Application | Configuration |
| --- | --- |
| API | `DATABASE_URL`, `SUPABASE_URL`, and server-only `SUPABASE_SECRET_KEY` for invitations and storage. Set `TEST_DATABASE_URL` to a separate local test database. Optional: `TURNSTILE_SECRET_KEY` (required in production for sign-up), Google Wallet variables. |
| Dashboard | `VITE_API_URL`, `VITE_WEB_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY`. Optional: `VITE_LANDING_URL`, `VITE_TURNSTILE_SITE_KEY`; production only: `VITE_MERCHANT_URL`, `VITE_ADMIN_URL`. |
| Customer website | `VITE_API_URL`. |
| Landing page | `VITE_API_URL`, `VITE_MERCHANT_URL`, and `VITE_STOREFRONT_URL`. |

Set the API's allowed origins for the browser clients:

```dotenv
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175
```

Leave `VITE_MERCHANT_URL` and `VITE_ADMIN_URL` empty in the dashboard locally so every account can sign in on one address.

Keep `.env` files, service-account keys, database credentials, and signing keys out of Git. Only public values belong in `VITE_*` and `EXPO_PUBLIC_*` variables.

### 3. Prepare the database and access

From `apps/api`, apply migrations to your intended development database:

```bash
cd apps/api
npx prisma migrate deploy --config prisma7.config.ts
```

This command changes the database selected by `DATABASE_URL`; verify that target before running it. Prepare the separate local test database with the same migrations before integration testing.

The SQL schema reference is [database/dvote_schema.sql](database/dvote_schema.sql), with a sample merchant in [database/dvote_seed_joy_corner.sql](database/dvote_seed_joy_corner.sql). Keep Supabase's Data API locked down using [database/supabase_lockdown.sql](database/supabase_lockdown.sql), including after migrations add tables.

From the repository root, configure Storage and bootstrap a platform admin when needed:

```bash
npm run storage:setup
npm run admin:create -- --name "Your Name" --email "you@example.com" --password "<password>"
```

The dashboard guides platform admins through authenticator-based MFA. Merchants can sign up themselves at `/signup` (Supabase must allow email sign-ups with "Confirm email" on); their team members are invitation-based. Configure `STAFF_INVITE_REDIRECT_URL` and Supabase's allowed redirect URLs for the dashboard's `/set-password` page.

### 4. Start the apps

Run each command in its own terminal from the repository root:

| Command | Application | Local address |
| --- | --- | --- |
| `npm run api:dev` | API | `http://localhost:3000` |
| `npm run dashboard:dev` | Merchant and admin dashboard | `http://localhost:5173` |
| `npm run web:dev` | Customer website | `http://localhost:5174` |
| `npm run landing:dev` | Landing page | `http://localhost:5175` |

Check database connectivity at [API health](http://localhost:3000/api/health). In development, explore [Swagger UI](http://localhost:3000/api/docs) or the [OpenAPI JSON](http://localhost:3000/api/docs-json). Swagger is disabled in production.

Phone-browser camera scanning, including a paired phone at `/pair`, requires HTTPS when deployed.

## Development and verification

Run these commands from the repository root as appropriate to the change:

| Task | Command |
| --- | --- |
| API unit tests | `npm run api:test` |
| API integration tests | `npm run api:test:e2e` |
| API lint | `npm run api:lint` |
| API build | `npm run api:build` |
| Dashboard typecheck / build | `npm --prefix apps/dashboard run typecheck` / `npm --prefix apps/dashboard run build` |
| Customer website typecheck / build | `npm --prefix apps/web run typecheck` / `npm --prefix apps/web run build` |
| Landing page build | `npm --prefix apps/landing run build` |
| Install browser test tooling | `npm run ui:install` |
| Responsive browser tests | `npm run ui:test` |
| Browser test report | `npm --prefix apps/ui-tests run report` |
| Database backup | `npm run db:backup` |

API integration tests write and clean up data, require suitable local database permissions, and refuse non-local database hosts. The responsive Playwright suite uses mocked services and covers dashboard/customer pages, multiple roles, dialogs, plan gating, trial, phone pairing, dark mode, the default language, phone-to-wide-screen layouts, and Arabic RTL. See [apps/ui-tests/README.md](apps/ui-tests/README.md).

Before contributing, read [AGENTS.md](AGENTS.md) and the latest [project handoff](DVOTE_BRIEF.md). Keep user-facing copy localized (Arabic and English), follow the [brand guide](docs/brand/dvote-brand-guidelines.md) and existing design tokens and shared components, preserve tenant boundaries and ledger guarantees, and update documentation when behaviour changes.

## Deployment

Full steps, addresses, and costs are in [DEPLOY.md](DEPLOY.md). Branches: `develop` is integration, `main` is live (Cloudflare rebuilds the sites on merge).

- **API:** build the [Dockerfile](apps/api/Dockerfile) with `apps/api` as the build context. Supply environment variables through the host; migrate the intended database as a separate release step.
- **Dashboard, customer website, and landing page:** Cloudflare Workers static assets with single-page fallback (`wrangler.jsonc` in each app: `dvote-dashboard`, `dvote-web`, `dvote-landing`). One dashboard build serves both `merchant.dvote.co` and `admin.dvote.co`.
- **Wallet:** configure the Google issuer, service-account credentials, a stable `WALLET_TOKEN_SECRET`, and the correct public customer-site URL (`PUBLIC_WEB_URL`). Credentials stay on the server.

Print `https://m.dvote.co/<shop>?b=<branch-id>` on QR posters and NFC tags. Some older notes still say `dvote.co/<shop>` or `dvote.app`; the storefront lives on `m.dvote.co`.

## Documentation

| Resource | Purpose |
| --- | --- |
| [Project brief and handoff](DVOTE_BRIEF.md) | Product direction, decisions, implementation notes, and deployment status. |
| [Deployment guide](DEPLOY.md) | Addresses, Cloudflare, Supabase, API hosting, emails, Wallet, and go-live checks. |
| [Brand guidelines](docs/brand/dvote-brand-guidelines.md) | Brand v3.0: dvote Blue, DM Sans and Alexandria, contrast rules. |
| [Plans and gating spec](docs/billing-gating-spec.md) | Plan prices, Founding Merchants, and what each plan unlocks. |
| [Go-live checklist](docs/go-live-checklist.md) | Merchant setup steps before a shop goes live. |
| [Design specs](docs/superpowers/specs) | Loyalty Cards and phone scanner pairing designs. |
| [Codex repository guidance](AGENTS.md) | Technical conventions and business invariants. |
| [Additional project context](CLAUDE.md) | Detailed implementation and integration notes. |
| [Database schema](database/dvote_schema.sql) | SQL schema reference; incremental changes live in `apps/api/prisma/migrations`. |
| [Original product specification](docs/Coffee_Loyalty_Platform_Documentation.pdf) | Original v2 specification; some customer-app flows have since changed. |
| [Dashboard guide](apps/dashboard/README.md) | Dashboard development and configuration. |
| [Customer website guide](apps/web/README.md) | Public-site routes and development setup. |
| [Landing page guide](apps/landing/README.md) | Landing page development and deployment. |
| [Staff app guide](apps/staff/README.md) | The parked Expo scanner. |
| [Browser test guide](apps/ui-tests/README.md) | Responsive checks, mocked fixtures, and reports. |
| [Email templates](docs/email-templates/README.md) | Branded Supabase emails (EN/AR): confirm sign-up, invite, password reset, and more. |
| [API client placeholder](packages/api-client/README.md) | Planned generated TypeScript client. |

Older app guides and the original specification may describe previous flows. Use the current source and the latest project brief to resolve status differences.
