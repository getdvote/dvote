# dvote landing page (dvote.co)

React 19 + Vite + Tailwind v4 + shadcn/ui (Radix) + React Router 7, port **5175** (`npm run landing:dev` at the repo root, or `npm run dev` here).

## One page

`/` is the whole site (`src/pages/home.tsx`), in this order: hero (`#top`, the one blue block, with the demo phone), problem, how it works (`#how`), the stand, platform features (`#features`), channel, channel comparison, geo, pricing (`#pricing`, with the plan comparison `#compare` and the Founding Merchants banner `#founding`), FAQ and contact (`#faq`, `#contact`). Sections live in `src/components/sections/`. The old addresses `/features`, `/pricing` and `/contact` jump to their sections (the dashboard's "See plans" uses `/pricing`); anything else goes to `/`.

## Languages

**Egyptian Arabic is the default**, English the other language. Every word is in `src/i18n/ar.ts` / `en.ts` (same keys). The header switch is saved in this browser (localStorage `dvote-landing-language`, English only if saved); `index.html` sets right-to-left before the first paint.

## Plans and pricing

Prices, the trial length and the Founding Merchants counter come from the API, `GET /api/public/plans` (`src/lib/plans.ts`). The page starts with a built-in copy (`FALLBACK_PLANS`) and swaps in the API answer, so it never shows blanks when the API is down. The source of truth is `apps/api/src/plans/plans.ts`: **when prices change there, update `FALLBACK_PLANS` too.** Plans: Regular / Loyal / Chain (EGP 499 / 999 / 1,999 a month incl. the first branch, extra branches priced per plan, annual = 10 months), a 14-day free trial, Founding Merchants 30% off for 6 months. The pricing section has a branch-count calculator and a Monthly / Annual switch. See `docs/billing-gating-spec.md`.

"Start free trial" opens `merchant.dvote.co/signup?plan=&cycle=` (`signupUrl` in `src/lib/config.ts`); the dashboard saves the chosen plan on the trial shop. "Log in" opens the merchant dashboard; sign-in never happens on this page.

## Settings

`.env` (copy `.env.example`; public values only):

| Variable | What | Production |
| --- | --- | --- |
| `VITE_MERCHANT_URL` | "Log in" and "Start free trial" | `https://merchant.dvote.co` |
| `VITE_STOREFRONT_URL` | Privacy and Terms (they live on the customer storefront) | `https://m.dvote.co` |
| `VITE_API_URL` | Plans and the Founding counter | `https://api.dvote.co` |

WhatsApp number and email: `src/lib/config.ts`. Add the landing origin (`http://localhost:5175` locally) to the API's `CORS_ORIGINS` so the plans load.

## Brand

Brand v3.0 (`docs/brand/dvote-brand-guidelines.md`): dvote Blue only on the hero (`.on-blue` scopes its tokens), a neutral Espresso frame elsewhere, DM Sans and Alexandria. Tokens in `src/styles.css`. The SVGs in `public/brand` must stay identical to `apps/dashboard/public/brand` (the dashboard also has `illustrations/dark` for its dark mode). `public/email` holds the images the Supabase email templates link to (`dvote.co/email/...`); don't remove them.

## Deploy

Cloudflare Workers static assets (`wrangler.jsonc` → Worker `dvote-landing`), root `apps/landing`, build `npm ci && npm run build`, deploy `npx wrangler deploy`, the three build variables above, custom domain `dvote.co`. See [DEPLOY.md](../../DEPLOY.md) step 4.
