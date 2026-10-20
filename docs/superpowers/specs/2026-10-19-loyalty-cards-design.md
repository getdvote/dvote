# Loyalty Cards area — design

Date: 2026-10-19 · Status: draft for approval

## Intent

Merchants build and run their wallet loyalty card from one place in the dashboard, the way tappi
(thetappi.com) does it: a Cards page with the card and its actions, a step-by-step funnel for
the first card, and a "Card design" editor with a live iPhone / Android preview and a version
history. The 16 reference screenshots show **tappi's** UI. dvote has none of these screens
today, so this area is **built new** in dvote, using tappi as the model plus the user's changes.

Today dvote has a single `/card` page (`pages/my/MyCard.tsx`). It holds a 10-design picker
(`vendors.card_design`) and the points-rule editor (`RulesTab`). The vendor row *is* the card.
Wallet passes are **Google Wallet only** (`wallet/google-wallet.service.ts`). Apple Wallet is not
built.

## Goals

1. **One card per merchant.** "Create new card" shows only when the merchant has no card (or
   the cancelled card's 30-day restore window has passed).
2. **First card = a funnel in a modal**, step by step:
   1. Name: the card name, shown on the pass title by default.
   2. Points rule: "Every [amount] [currency] spent = 1 point", with a live sentence below it.
   3. Look: background colour (defaults to the brand colour) and one of the 5 background designs.
   4. Review & create: a preview of the card. Create makes the card live and saves it as V1.
3. **Cards page:** a card tile with the front preview, name, "Points" type, status badge
   (Live / Paused / Cancelled), counts (members, active in the last 30 days), "View members",
   a primary "Design card" button and a "…" menu.
4. **"…" menu:**
   - **Card settings** (modal): card name + points rule (money for 1 point) only.
   - **Copy share link:** the storefront link (`storefrontUrl(vendor)`, the same link as the
     storefront preview).
   - **Get QR to add this card:** the existing `qr-poster-dialog` for that link.
   - **Pause / Resume:** pausing stops **new sign-ups only**. The join page says the card is
     paused, and existing members keep earning and redeeming.
   - **Delete (cancel card):** a confirmation dialog. The card is retired, no sign-ups or
     earning/redeeming, and members' Google passes are set INACTIVE. Balances and the ledger are
     kept. The card can be **restored within 30 days** ("Restore" on the tile, with days left).
     Restoring brings everything back as it was.
5. **Members modal:** search (name / email / phone) and a table with name, email, phone, joined
   date and points. It renders as cards on mobile (reuses the new responsive table pattern).
6. **Card design editor** (`/card/design`), with the editor on the left and a sticky preview on
   the right:
   - **Colours:** background, text and small labels, each with a hex input + swatch.
     "Use my brand colour" sets the background; "Pick automatically" sets text and labels by
     contrast. Kept as in tappi.
   - **Font:** removed.
   - **Logo:** none to set here. The card uses the merchant logo, with a one-line note linking to
     the shop profile.
   - **Background:** either one of **5 designs tinted with the background colour** (Solid, Soft
     gradient, Mesh glow, Waves, Grid dots), or an **uploaded image** (with remove).
   - **Card front:** card title (EN + AR, defaults to the card name) and the label above the
     points (EN + AR, defaults to "Points" / "النقاط"). No extra detail fields. The front always
     shows the cardholder name and the card code.
   - **Buttons under the card (max 2):**
     - Button 1 is locked to the merchant's storefront page. Only its label is editable
       (EN + AR, default "Offers & Rewards" / "العروض والمكافآت").
     - Button 2 is one of: No button · Directions (pick one of the merchant's active branches;
       uses its map location) · Call (phone input with country code, reusing `lib/phone.ts`).
   - **Back of the card:**
     - About this card (textarea).
     - Opening hours: days + times with the existing `WeeklyHoursEditor` (split shifts,
       closed days).
     - Links (up to 5): platform dropdown (Instagram, Facebook, TikTok, X, Snapchat, WhatsApp,
       YouTube, LinkedIn, Website, Custom link) + handle/URL. Custom link also takes a label.
     - Terms (optional textarea).
7. **Preview:** device switch **iPhone | Android** ("Older iPhone" removed) × language **EN | AR**
   × side **Front | Back** (Android: "Details"). A small number input "Preview with [73] points"
   (0–99,999) replaces the slider. Arabic preview renders RTL with the Arabic strings.
   - iPhone preview is a mock-up only (Apple passes aren't generated yet).
   - On mobile (< 1024px) the preview moves into a floating "Preview" button that opens a
     sheet, the same pattern as the storefront editor.
8. **History:** every save of the editor creates a new immutable version (V1, V2, …). One
   version is **live**. Each row shows "V3 · 19 Oct 2026 14:02 · by Name", plus a **Use this**
   button on every non-live row. "Use this" makes that version live without creating a new one,
   so you can go from V5 to V1 and back to V5. Saving after going back creates V6 from the
   editor's content. Saving or switching versions updates every member's pass.
9. **EN / AR + RTL and responsive** throughout, using the dashboard's shadcn components, tokens,
   Solar icons and the `t()` i18n.

## Non-goals (for now)

- More than one card per merchant, or card types other than points (stamps etc.).
- The other fields from tappi's settings modal: sign-up form fields (phone, birthday), daily cap,
  "call them", reward levels inside the card, birthday reward. Rewards stay on the Rewards page.
- tappi's other tabs (Balance, Sign-ups, Poster, Promotions), "Brand defaults" and "Send test to
  my phone".
- Apple Wallet pass generation (needs the Apple Developer account).
- Font choice.

## Anti-goals

- Existing members must not notice anything during the migration: their passes, balances, the
  QR codes staff scan and the join link keep working.
- No business data is ever hard-deleted (the repo rule). Cancel is a status.

## Data & API (my calls, for review)

- **New table `loyalty_cards`**: `id`, `vendor_id` (unique: one per merchant), `name`,
  `status` (active / paused / cancelled, CHECK), `cancelled_at`, `live_version_id`,
  `created_at` / `updated_at`. `cards` stays the customer's card at a merchant. The members of the
  loyalty card are that vendor's `cards` rows.
- **New table `loyalty_card_versions`**: `id`, `card_id`, `vendor_id`, `number` (1, 2, …,
  unique per card), `design` jsonb (colours, background, front, buttons, back),
  `created_by` (staff), `created_at`. Append-only.
- The points rule stays in `point_rules` (already versioned). Card settings writes a new rule
  with `points_per_spend = 1` and leaves `min_purchase` / `max_points_per_purchase` unchanged.
- **Migration `29_loyalty_cards`:** creates the tables and makes one card per existing merchant:
  `name` = merchant name, V1 = colours from `brand_primary` (or the old `card_design` colour), the
  Solid design and the defaults above. Applied to the cloud only after you confirm. Re-run
  `supabase_lockdown.sql` (new tables). Mirror the change in `database/dvote_schema.sql`.
- **Vendor API** (`/api/vendor/loyalty-card`): get (card, live version, versions list,
  counts), create (funnel), settings update, pause / resume, cancel / restore, save design
  (new version), make a version live, upload / remove the background image (Storage, like the
  banner), list members.
- **Rules enforced in the API:** create is refused while a card exists or is still restorable.
  Join is refused while paused or cancelled. Scans (earn / redeem) are refused while cancelled.
  Restore is refused after 30 days.
- **After the 30 days** the merchant can create a new card. The existing member cards
  (`cards`, one per user × vendor) belong to the new card, with balances kept, and their passes
  come back. *My call:* the customer card is unique per merchant, so starting balances from zero
  would mean deleting business rows.

## Wallet pass (Google) from the live version

- Class: `hexBackgroundColor` = background colour; `heroImage` = the uploaded background image
  if any (else the shop banner, as today); `localizedProgramName` EN/AR = card title;
  logo = merchant logo (as today).
- Object: `loyaltyPoints.label` = points label (localized EN/AR); account name + code as today.
- Text modules: About, Opening hours (formatted), Terms. Links module: Button 1 (storefront,
  first so Android shows it as the card's button), Button 2 (maps URL for the branch or
  `tel:`), then the social links.
- Google can't draw the tinted patterns (Waves, Dots …). The pass uses the flat colour, and the
  patterns appear in the dashboard preview and the web card page.
- Saving a version / switching the live version / pause / cancel / restore re-syncs passes
  through the existing reconcile path. Cancel sets objects `INACTIVE`; restore sets them back to
  `ACTIVE`.
- The customer web card (`apps/web` `LoyaltyCard`) reads the same live design (colours,
  background, title, label), so the join page matches the pass. *My call: a small change.*

## Constraints

- Shared checkout: other sessions' uncommitted work (responsive tables, storefront FAB) must
  not be touched. The editor reuses their patterns without editing their files unless that's
  required.
- Cloud DB migration only after the user confirms. Commit only after the user gives the
  message (author Mohamed Marrouf).
- Done = API + dashboard build/typecheck, the relevant `apps/ui-tests` specs, and screenshots
  of the funnel, menu, settings, editor (EN + AR, desktop + mobile) and a history revert.

## Smaller calls I made (check while reading)

- Only the merchant admin can create, edit, pause, cancel or restore. Branch managers and
  viewers see the page read-only (members, preview, history).
- The platform-admin merchant workspace gets the same area through `useVendorApi()` and the
  admin prefix, as the repo rules require.
- New error codes: `card_exists`, `card_not_found`, `card_paused` (join), `card_cancelled`
  (join + scans), `restore_expired`, `version_not_found`.
- Editor changes stay in the page until **Save**. Leaving with unsaved changes asks first.
  There's no server-side draft (unlike tappi's "Draft saved").
- About, Opening hours and Terms are single text, not EN + AR (only the front texts and the
  button label are bilingual, as asked).
- Background image: uploaded through the API like the banner, re-encoded to WebP at 1200 px
  wide, stored at `<vendorId>/card/<uuid>.webp`. Old files are kept while an older version still
  uses them.
- The web join page shows "This card is paused, new sign-ups are closed for now" while paused.

## Left to the builder

Exact copy wording, spacing, the visual drawing of the 5 patterns (they should feel modern:
soft gradients and glows, not clip-art), the order of social platforms, empty/loading/error
states, and how the routes/nav label read ("Cards" under Loyalty).
