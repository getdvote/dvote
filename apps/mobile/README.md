# apps/mobile

Customer mobile app (iOS + Android). **Not scaffolded yet.** (Vendor staff use a separate app: `apps/staff`.)

Planned stack: React Native + Expo (TypeScript), `@supabase/supabase-js` for Google / Facebook
sign-in, a QR code renderer for the one-time collect / redeem codes. No NFC.

Screens: my cards · vendors (master collect QR) · vendor page (vendor collect QR, rewards,
redeem QR) · card history · profile.

To scaffold (later), from the repo root:

```bash
npx create-expo-app@latest apps/mobile --template blank-typescript
```

API calls use the shared TypeScript client in `packages/api-client` (generated from the
backend's OpenAPI spec), the same one the dashboard uses.
