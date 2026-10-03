# apps/staff

Staff scanner app (iOS + Android) for vendor staff, branch managers and vendor admins. **Not scaffolded yet.**

Planned stack: React Native + Expo (TypeScript), camera QR scanning, `@supabase/supabase-js`
for staff sign-in (email + password from the invite).

Screens: sign in (vendor admins pick a branch) · scan · enter receipt total (collect) ·
confirm reward (redeem) · result · today's activity.

Calls `/api/vendor/scans/*` through the shared TypeScript client in `packages/api-client`.

To scaffold (later), from the repo root:

```bash
npx create-expo-app@latest apps/staff --template blank-typescript
```
