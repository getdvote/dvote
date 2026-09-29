# apps/mobile

Customer mobile app (iOS + Android). **Not scaffolded yet.**

Planned stack: React Native + Expo (TypeScript), `react-native-nfc-manager` for NFC
(NTAG 424 DNA SUN reads), `@supabase/supabase-js` for Google / Facebook sign-in.

NFC is a native module, so the app runs as an Expo **development build**, not in Expo Go.

To scaffold (later), from the repo root:

```bash
npx create-expo-app@latest apps/mobile --template blank-typescript
```

API calls use the shared TypeScript client in `packages/api-client` (generated from the
backend's OpenAPI spec), the same one the dashboard uses.
