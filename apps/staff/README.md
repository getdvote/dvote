# apps/staff — dvote staff app

Expo (React Native) app for vendor staff: **one codebase for the web (any phone/PC browser)
and iOS/Android**. Its only job: scan the customer's one-time QR, enter the bill amount,
and let the server add the points.

Screens (`src/app`, Expo Router), following the designs:

| Route | Screen |
|---|---|
| `/login` | Login with your provided account (email + password from the vendor's invite) |
| `/home` | Welcome + vendor logo + branch, the point rule, **Start scanning** (vendor admins pick a branch) |
| `/scan` | Camera QR scanner (web and native), or "Type the code instead" |
| `/amount` | Enter bill amount, live points estimate, the rule, **Grant points** |
| `/done` | "N points granted, Thanks!" + Back home |

The server decides the points (`POST /api/vendor/scans/collect`); the app only shows an estimate.
Each bill gets one random `idempotencyKey`, so a retry after a network error never adds points twice.

## Run it

1. `cp .env.example .env` and fill in `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the **publishable** key).
2. The API must allow the app's origin: in `apps/api/.env` add
   `CORS_ORIGINS=http://localhost:8081` and restart the API.
3. From the repo root: `npm run staff:install` (first time), then `npm run staff:web`
   → opens http://localhost:8081.

On a phone: the browser camera needs **https** (or localhost), and `localhost` means the phone
itself — use the Expo Go app / a development build, or an https tunnel, and set
`EXPO_PUBLIC_API_URL` to an address the phone can reach.

## Checks

`npm run typecheck` · `npx expo-doctor`. Add packages with `npx expo install <pkg>` (SDK-compatible
versions). Expo APIs change every SDK: read the versioned docs (see `AGENTS.md`).

API types are hand-written in `src/lib/api.ts` until `packages/api-client` is generated.
