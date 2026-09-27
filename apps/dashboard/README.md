# apps/dashboard

Vendor + admin web dashboard. **Not scaffolded yet.**

Planned stack: React + TypeScript (Vite), Ant Design, TanStack Query, Recharts.
One app with role-based routes for vendor staff and platform admins.

To scaffold (later), from this folder:

```bash
npm create vite@latest . -- --template react-ts
```

API types come from `packages/api-client` (generated from the NestJS OpenAPI spec).
