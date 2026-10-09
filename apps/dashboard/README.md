# apps/dashboard — dvote admin dashboard

React 19 + TypeScript (Vite), Ant Design 6, TanStack Query, Recharts, React Router 7.
Web only. Also the vendor dashboard: vendor admins and branch managers sign in on the same screen and see only their own vendor (the vendor comes from their token). Staff accounts are refused (staff app).

## Run

1. `cp .env.example .env` and fill in the Supabase URL and **publishable** key (same as the apps).
2. The API must allow this origin: `CORS_ORIGINS=…,http://localhost:5173` in `apps/api/.env`.
3. From the repo root: `npm run dashboard:install` (first time), then `npm run dashboard:dev` → http://localhost:5173

## Sign-in

Platform admins only (created with `npm run admin:create` in apps/api). Email + password, then the
6-digit code from an authenticator app; the first time, the page shows a QR code to set it up.

## Pages

| Route | Page |
|---|---|
| `/` | Overview: totals, points and collects per day, new customers, busiest shops |
| `/vendors` | All vendors: search, status filter, **New vendor** |
| `/vendors/:id` | Vendor: logo, edit, suspend/activate; tabs Branches, Points rule, Rewards (EN + AR), Menu & photos, Staff (invite owner) |
| `/customers` | Customers: search, filter, details drawer (cards, activity), block/unblock |

`npm run typecheck` · `npm run build`. API types are hand-written in `src/lib/api.ts` until `packages/api-client` exists.
