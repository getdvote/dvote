# apps/mobile — dvote customer app

Expo (React Native) app for customers, **iOS and Android only** (no web).
Expo SDK 57 + Expo Router; designs from the customer app mockups.

| Route | Screen |
|---|---|
| `/welcome` | Log in / Sign up: Google, Facebook, or email + password |
| `/check-email`, `/forgot-password`, `/reset-password` | Email confirmation and password reset |
| `/auth-callback` | Where Supabase links open the app (`dvote://auth-callback`) |
| `/(tabs)/cards` | All cards (one per shop where you have points) → `/card/[id]` history |
| `/(tabs)/discover` | Discover shops — placeholder until `GET /api/app/vendors` exists |
| `/(tabs)/you` | Profile hub (side menu) with the ⋮ menu: Logout / Delete account |
| `/profile-details`, `/settings`, `/about`, `/info/[topic]` | Pushed pages |
| `/qr` | QR button: one-time collect QR (5 min), polls every 2 s, then "+N points" + new balance. Closing it cancels an unused QR. Works at any shop: the scanning staff decide the vendor |

## Run it on a phone

1. `cp .env.example .env` and fill in `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the **publishable** key).
   Keep `EXPO_PUBLIC_API_URL=http://localhost:3000`: in development the app points it at the PC
   Expo runs on (`src/lib/config.ts`).
2. In Supabase → Authentication → URL Configuration → **Redirect URLs**, add `exp://**` (Expo Go)
   and `dvote://**` (real builds), so Google / Facebook / email links can come back to the app.
3. From the repo root: `npm run mobile:install` (first time), then `npm run mobile:start` (Expo on **port 8082**,
   so it can run next to the staff app on 8081), and scan
   the QR with **Expo Go** (Android: inside Expo Go; iPhone: Camera app). Phone and PC on the same Wi-Fi.

## Preview in a browser (dev only)

The product is iOS/Android; the web build is only a quick preview (e.g. Claude's browser pane at phone size):
`npm run web` (port 8082). The API's `CORS_ORIGINS` must include `http://localhost:8082`, and Google /
Facebook on web need `http://localhost:8082/**` in Supabase Redirect URLs. Email sign-in works as is.

## Languages

English (default) and Arabic, switched in Settings → Language (saved on the phone). Texts live in
`src/i18n/en.ts` and `src/i18n/ar.ts` (same keys, checked by TypeScript); screens use
`useI18n().t('key')`. Arabic turns the layout right-to-left and uses IBM Plex Sans Arabic.

## Checks

`npm run typecheck` · `npx expo-doctor`. Add packages with `npx expo install <pkg>`.
Expo APIs change every SDK: read the versioned docs (see `AGENTS.md`).
API types are hand-written in `src/lib/api.ts` until `packages/api-client` is generated.
