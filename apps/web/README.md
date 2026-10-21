# dvote public site (`apps/web`) — dvote.app

What a customer opens from the NFC tag or the printed QR at a merchant's till. Mobile first,
English + Arabic (right-to-left), no app install.

| Page | What it does |
|---|---|
| `/<merchant-slug>` (e.g. `/joy-corner?s=nfc&b=<branch>`) | Venue page: logo, "Loyalty card", the points rule, rewards, "Already have a card? Get it back" |
| `/<merchant-slug>/join` | One form: name, email, Egyptian mobile, "How did you hear about us?" (optional), 14+ → the card at once (no code, no sign-in). `?back=1` (get it back): email + the same mobile → the same card. |
| `/c/<publicId>` | "You're enrolled!" / "Welcome back!": the card (merchant design, points, cardholder, short code) and the wallet button for this phone (iPhone → Apple Wallet, Android → Google Wallet, computer → both + a QR to open the page on the phone). Wallet buttons are disabled until the passes are built. |
| `/privacy` | "How your data is used" (draft text) |

`?s=` = how the page was opened (`nfc` / `qr`, else `link`), `?b=` = the branch id of the tag. Both are kept through the flow and saved on the card.

## Run

```bash
npm install
npm run dev        # http://localhost:5174 (add --host to try it from a phone on the same Wi-Fi)
```

Needs the API running (`/api/public/*`) and `.env` with `VITE_API_URL` (copy `.env.example`).

**Before launch:** add a captcha (Cloudflare Turnstile) to the join form: it needs no sign-in, so anyone can post it.

## One-time setup outside the code

- **API:** `CORS_ORIGINS` in `apps/api/.env` must include this site's origin (`http://localhost:5174` locally, `https://dvote.app` live).

Code: `src/pages` (Venue, Join, Card, Info), `src/components` (page frame, card preview), `src/i18n` (`en.ts` is the source of every key; `ar.ts` must match), `src/lib/cardDesigns.ts` (keep identical to the dashboard's).
