# apps/dashboard — dvote admin dashboard

React 19 + TypeScript (Vite), Tailwind CSS v4 + shadcn/ui (Radix primitives, Lucide icons, Sonner toasts),
TanStack Query, Recharts (through shadcn `chart`), React Router 7. Web only. Also the vendor dashboard: vendor admins and branch managers sign in on the same screen and see only their own vendor (the vendor comes from their token); staff accounts are refused (staff app).

## Run

1. `cp .env.example .env` and fill in the Supabase URL and **publishable** key (same as the apps).
2. The API must allow this origin: `CORS_ORIGINS=…,http://localhost:5173` in `apps/api/.env`.
3. From the repo root: `npm run dashboard:install` (first time), then `npm run dashboard:dev` → http://localhost:5173

## UI

- shadcn components live in `src/components/ui` (our code: edit freely). Add more with
  `npx shadcn@latest add <name>` from this folder.
- dvote theme: brand purple as the one accent, Inter, grey canvas with white cards. All colours are
  tokens in `src/styles.css` (`bg-card`, `text-muted-foreground`, `bg-brand-soft`, `text-success`…);
  never hard-code hex values.
- Light / dark / system: toggle in the top bar, saved in localStorage (`src/lib/theme.tsx`;
  `index.html` applies it before the first paint).
- Shared pieces in `src/components`: `PageHeader`, `StatusTag`, `ConfirmAction` (ask before
  suspend/block/delete), `Field` (form rows), `TableState`, `ListControls` (search, status filter,
  pager), `ErrorAlert`, `ThemeToggle`.

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
