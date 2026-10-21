# dvote landing page (dvote.co)

React 19 + Vite + Tailwind v4 + React Router 7, port **5175** (`npm run landing:dev` at the repo root, or `npm run dev` here).
English + Arabic: every word is in `src/i18n/en.ts` / `ar.ts` (same keys; Arabic is right-to-left; switch in the header, saved in this browser).

Pages: `/` home (hero, how it works, why dvote, features preview, plans preview, call to action), `/features`, `/pricing` (3 plans by branch count, prices "coming soon": edit `pricing` in the dictionaries when prices are set), `/contact` (WhatsApp, email, FAQ).
"Log in" opens the merchant dashboard (`VITE_MERCHANT_URL`); Privacy / Terms live on the customer storefront (`VITE_STOREFRONT_URL`). Contact details: `src/lib/config.ts`.

Deploy: Cloudflare Workers static assets (`wrangler.jsonc` → Worker `dvote-landing`), root `apps/landing`, build `npm ci && npm run build`, deploy `npx wrangler deploy`, build variables `VITE_MERCHANT_URL=https://merchant.dvote.co`, `VITE_STOREFRONT_URL=https://m.dvote.co`, custom domain `dvote.co` (see DEPLOY.md step 4).
