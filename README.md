# dvote

Spend-based loyalty points and rewards for coffee shops, using one-time QR codes. See [CLAUDE.md](CLAUDE.md) for the full brief.

```
dvote/
├── apps/
│   ├── api/          # NestJS + Prisma backend (active)
│   ├── dashboard/    # React vendor + admin dashboard (not scaffolded yet)
│   ├── mobile/       # React Native (Expo) customer app (not scaffolded yet)
│   └── staff/        # React Native (Expo) staff scanner app (not scaffolded yet)
├── packages/
│   └── api-client/   # generated TS client from OpenAPI (not generated yet)
├── database/         # dvote_schema.sql — DB source of truth
└── docs/             # product spec (PDF + HTML source)
```

## Backend

```bash
cd apps/api
npm install
npm run start:dev
```

`apps/api/.env` needs `DATABASE_URL` (never commit it). From the repo root you can also run `npm run api:dev`, `npm run api:test`, etc.
