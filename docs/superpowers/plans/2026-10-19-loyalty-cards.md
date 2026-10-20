# Loyalty Cards Area Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tappi-style Cards area in the merchant dashboard (one card, creation funnel, action menu, settings, members, design editor with iPhone/Android EN/AR preview, version history), backed by new `loyalty_cards` / `loyalty_card_versions` tables and feeding the Google Wallet pass.

**Architecture:** One API feature module `src/loyalty-cards/` (service + vendor controller, also mounted in the admin workspace). The design is a validated JSON document stored per immutable version; the card row points at the live version. Wallet sync reuses `GoogleWalletService` by touching `vendors.updated_at` and calling `vendorChanged`. Dashboard: `pages/my/cards/` (page, funnel, menu dialogs, members, editor, preview, history) replacing `MyCard`.

**Tech Stack:** NestJS + Prisma 7 + Postgres (Supabase), React 19 + Vite + Tailwind v4 + shadcn + TanStack Query, Solar icons, Playwright ui-tests.

**Spec:** `docs/superpowers/specs/2026-10-19-loyalty-cards-design.md`

## Global Constraints

- One card per merchant; create refused while a card exists or is restorable (`card_exists`).
- Cancel is restorable for 30 days (`restore_expired` after). Never hard-delete business rows.
- Pause blocks new sign-ups only (`card_paused` on join); cancel blocks join + scans (`card_cancelled`).
- Only `vendor_admin` changes anything; `branch_manager`/`viewer` read.
- Defaults: points label EN "Points" / AR "النقاط"; button 1 EN "Offers & Rewards" / AR "العروض والمكافآت"; title = card name.
- Max 2 buttons, max 5 links, preview points 0–99,999, 5 backgrounds: `solid | gradient | mesh | waves | dots`.
- Every user-facing string in `i18n/en.ts` + `ar.ts`; logical CSS (`ps/pe/ms/me/start/end`); Solar icons only.
- Don't edit the other sessions' files (`components/ui/table.tsx`, `styles.css`, `storefront-editor.tsx`, `ui-tests/tests/storefront.spec.ts`) unless required.
- Cloud migration and commits only after the user confirms (commit author Mohamed Marrouf).

## Review Focus

- Existing merchant with members after migration: still one card, V1 live, scans + join unchanged.
- Cancel then restore on day 29 vs day 31 (the boundary): restore OK / `restore_expired`.
- Revert V5→V1→V5: live pointer moves, no new versions, passes re-sync.
- Arabic preview with empty AR fields falls back to EN text; RTL layout of the preview.
- Editor at 375px: preview behind the floating button, no sideways overflow (ui-tests audit).

---

### Task 1: Migration 29_loyalty_cards + schema

**Files:** Create `apps/api/prisma/migrations/29_loyalty_cards/migration.sql`; modify `database/dvote_schema.sql`, `apps/api/prisma/schema.prisma` (via `npm run db:pull` when a DB is reachable, else hand-mirror).

- [ ] Tables: `loyalty_cards(id, vendor_id UNIQUE FK vendors, name varchar(60), status varchar(10) CHECK in (active,paused,cancelled), cancelled_at timestamptz, live_version_id uuid, created_at, updated_at + trigger)`; `loyalty_card_versions(id, card_id, vendor_id, number int, design jsonb NOT NULL, created_by_staff_id uuid NULL, created_by_admin_id uuid NULL, created_at; UNIQUE(card_id, number); FK (card_id) → loyalty_cards)`; FK `loyalty_cards.live_version_id → loyalty_card_versions(id)` DEFERRABLE.
- [ ] Backfill: one card + V1 per vendor (name = vendor name, design = default JSON with `colors.background` = `brand_primary` or the old design colour).
- [ ] RLS on both tables (lockdown pattern).
- [ ] Apply to the local test DB only; cloud waits for the user.

### Task 2: Design document validation (`src/loyalty-cards/card-design.ts`)

**Interfaces — Produces:** `type CardDesign`, `defaultDesign(name: string, color: string): CardDesign`, `checkDesign(input: unknown): CardDesign` (throws 400 `invalid_design`).
CardDesign = `{ colors: {background, text, label: '#rrggbb', useBrand, autoText, autoLabel: boolean}, background: {style: 'solid'|'gradient'|'mesh'|'waves'|'dots', imageUrl: string|null, imagePath: string|null}, front: {title: {en, ar}, pointsLabel: {en, ar}}, buttons: {primaryLabel: {en, ar}, secondary: {type:'none'} | {type:'directions', branchId} | {type:'call', phone}}, back: {about: string, hours: HoursSlot[], links: {platform, value, label?}[], terms: string} }`.

- [ ] Unit spec `card-design.spec.ts`: defaults; rejects 6 links, bad hex, unknown style, >3 slots/day; strips unknown keys; text lengths (title 40, label 20, about 1000, terms 2000).

### Task 3: LoyaltyCardsService + controller + workspace mount

**Files:** `src/loyalty-cards/loyalty-cards.module.ts` (service, controller, DTOs), register in `app.module.ts`, add `[LoyaltyCardController, 'loyalty-card']` in `admin/workspace.module.ts`, `IMAGE_PRESETS.card_background {1200, 760, cover}`.

Endpoints under `/api/vendor/loyalty-card` (GET roles admin/manager/viewer; rest vendor_admin):
`GET /` → `{card|null, liveVersion, versions[{id, number, createdAt, createdBy}], counts{members, active30d}, rule, restorableUntil}` · `POST /` `{name, spendAmount, design}` · `PATCH /settings` `{name?, spendAmount?}` · `POST /pause` · `POST /resume` · `POST /cancel` · `POST /restore` · `POST /versions` `{design}` · `POST /versions/:id/live` · `PUT|DELETE /background` (multipart; returns `{imageUrl, imagePath}`, not versioned until saved) · `GET /members?search&page`.
Every write touches `vendors.updated_at` in the same tx and calls `wallet.vendorChanged(vendorId)` after commit.

- [ ] e2e `test/loyalty-cards.e2e-spec.ts` (local DB): create→V1; second create 409; settings writes rule v+1 with points_per_spend 1; save V2, V3, live V1, live V3 (count stays 3); pause→join 409 `card_paused`, scan OK; cancel→scan 403 `card_cancelled`; restore; cancelled_at 31 days ago → restore 409; viewer write 403; other vendor isolation.

### Task 4: Join, scans, Google pass

- [ ] `public-join.service.ts join()`: refuse `card_paused`/`card_cancelled` (409). `vendor()` / `card()` responses add `look: {design (front/colors/background), status}`.
- [ ] `scans.service.ts findWalletCard()`: cancelled → 403 `card_cancelled`.
- [ ] `google-wallet.service.ts branding()`: read the live version; colour, hero image, `localizedProgramName`, `textModulesData` (about/hours/terms), `linksModuleData` (storefront first, directions/call, links); object `loyaltyPoints.label` localized; state INACTIVE when cancelled. Pass `saveUrl` uses the same builder.

### Task 5: Dashboard data layer + i18n

- [ ] `lib/api.ts`: `LoyaltyCard*` types + vendor client methods named `loyaltyCard, createLoyaltyCard, updateLoyaltyCardSettings, pauseLoyaltyCard, resumeLoyaltyCard, cancelLoyaltyCard, restoreLoyaltyCard, saveLoyaltyCardVersion, makeVersionLive, uploadCardBackground, removeCardBackground, loyaltyCardMembers`.
- [ ] `lib/card-look.ts`: `BACKGROUNDS` (5), `readableInk(hex)`, `SOCIAL_PLATFORMS`, `linkHref(link)`, defaults mirroring the API.
- [ ] `i18n` namespace `cards.*` EN + AR.

### Task 6: Cards page, funnel, menu, settings, members

**Files:** `pages/my/cards/cards-page.tsx` (route `/card`), `create-card-dialog.tsx` (4 steps), `card-settings-dialog.tsx`, `card-members-dialog.tsx`, `card-face.tsx` (shared front renderer). Reuse `qr-poster-dialog.tsx`, `storefrontUrl`, `ConfirmAction`. Replace `MyCard` in router + AdminWorkspace.

### Task 7: Design editor + preview + history

**Files:** `pages/my/cards/card-design-page.tsx` (route `/card/design`), `card-preview.tsx` (iPhone/Android × EN/AR × front/back, points input), `card-history.tsx`. Sections: Colours, Background, Card front, Buttons, Back of the card. Mobile < 1024px: floating Preview button → Sheet. Unsaved-changes guard.

### Task 8: Verify

- [ ] `npm run build` in api + dashboard; api unit + new e2e; ui-tests: update `mock-api.ts` + `dashboard-merchant.spec.ts` (add `/card/design`), run.
- [ ] Browser: screenshots of funnel, menu, settings, editor EN+AR desktop+mobile, history revert → notes folder.
