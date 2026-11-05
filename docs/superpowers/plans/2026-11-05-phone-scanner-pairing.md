# Phone Scanner Pairing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let someone on the dashboard Scan page pair a phone with a QR and a 6-digit code, so the phone can scan for 12 hours with no sign-in.

**Architecture:** A new `scanner` API module stores pairings and issues opaque session tokens. A new guard on the scan routes accepts either a Supabase staff token or a session token and builds the same `StaffContext`, so `ScansService` doesn't change. The dashboard reuses the Scan page on a public `/pair` route through `VendorWorkspaceProvider` with a client that sends the session token.

**Tech Stack:** NestJS, Prisma with hand-written SQL migrations, PostgreSQL, React 19, TanStack Query, `qrcode.react`, Jest e2e with supertest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-05-phone-scanner-pairing-design.md`

## Global Constraints

- Code: 6 digits, expires after 5 minutes, single use, cancelled after 5 wrong tries.
- Session: 12 hours, and the limit keeps running during a pause.
- Pair secret: 128-bit random. Session token: 256-bit random. Store only SHA-256 hashes. Code hash = SHA-256 of secret + code. Never log any of the three.
- Claim limit: 10 per minute per IP. Scan limit: `LIMITS.scans` (60 per minute) per phone.
- `revoked_reason` values: `disconnected`, `ended_by_phone`, `staff_disabled`, `role_changed`, `branch_changed`.
- Ended: 401 `scanner_session_ended`. Paused: existing 403 `vendor_suspended`, `trial_ended`, `subscription_expired`, `branch_closed`.
- Failed claims always return the same 400 `pairing_invalid`.
- All user-facing text goes in `src/i18n/en.ts` and `ar.ts`, with logical CSS classes for RTL.
- **Never run a migration, `db:pull` or tests against the cloud database.** Set `DATABASE_URL` and `TEST_DATABASE_URL` to a local database for every command. Applying to Supabase needs the merchant's explicit approval.
- Commits: author Mohamed Marrouf, and ask the user to approve each commit message before committing. Messages below are suggestions.
- Work on `feature/phone-scanner-pairing`, branched after the design and checklist docs are committed.

## Review Focus

- A phone browser already signed in to the dashboard must scan with the session token, never the Supabase session. Pinned in Task 6.
- Reloading or reopening the phone page mid-session resumes scanning with no code. Pinned in Task 6.
- Losing internet on the phone must not look like an ended session or clear the token. Pinned in Task 6.
- Egyptian phones often type Arabic digits, so `٤٢٧٩١٠` or a pasted `427 910` must work as `427910`. Pinned in Task 6.
- Rescanning an already-used QR, or a second phone scanning it, gets `pairing_invalid` and doesn't affect the phone already paired. Pinned in Task 2.

---

### Task 1: Pairings table and token helpers

**Files:**
- Create: `apps/api/prisma/migrations/34_scanner_pairings/migration.sql`
- Modify: `database/dvote_schema.sql`, `apps/api/prisma/schema.prisma`, and `database/supabase_lockdown.sql` if it lists tables by name
- Create: `apps/api/src/scanner/scanner-token.ts`
- Test: `apps/api/src/scanner/scanner-token.spec.ts`

**Interfaces:**
- Produces, from `scanner-token.ts`:
  - `SESSION_PREFIX = 'dvs_'`
  - `newPairSecret(): string`, 32 hex characters
  - `newPairCode(): string`, 6 digits including leading zeros, from `crypto.randomInt`
  - `newSessionToken(): string`, `dvs_` + 64 hex characters
  - `sha256(value: string): string`
  - `hashCode(secret: string, code: string): string`
  - `sameHash(a: string, b: string): boolean`, using `timingSafeEqual`
- Produces: the Prisma model `scanner_pairings`

- [ ] **Step 1: Write the failing test**

```ts
it('makes a 6-digit code, keeping leading zeros', () => {
  for (let i = 0; i < 500; i++) expect(newPairCode()).toMatch(/^\d{6}$/);
});
it('makes secrets of the required strength', () => {
  expect(newPairSecret()).toMatch(/^[0-9a-f]{32}$/);
  expect(newSessionToken()).toMatch(/^dvs_[0-9a-f]{64}$/);
});
it('ties the code hash to the secret', () => {
  expect(hashCode('a', '123456')).not.toBe(hashCode('b', '123456'));
  expect(sameHash(hashCode('a', '123456'), hashCode('a', '123456'))).toBe(true);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && npm test -- scanner-token`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `scanner-token.ts` with the signatures above**

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/api && npm test -- scanner-token`
Expected: PASS.

- [ ] **Step 5: Write the migration**

Columns as in the spec's Data section:
- `secret_hash` is unique and not null. `session_token_hash` is unique and nullable.
- `failed_attempts` is an int defaulting to 0.
- Composite FKs: `(branch_id, vendor_id)` to branches and `(staff_id, vendor_id)` to `staff_users`, matching how `reward_sold_outs` does it.
- `revoked_by_staff_id` is a nullable FK to `staff_users`. `device_label` is `varchar(30)`.
- A CHECK limits `revoked_reason` to the five values, and requires it to be set exactly when `revoked_at` is set.
- Add an index on `(vendor_id, staff_id)`, the `updated_at` trigger used by other tables, and RLS enabled.

- [ ] **Step 6: Apply it to a local database and refresh Prisma**

Run, with `<local>` an existing local database (`dvote_plans_test` exists):
```bash
cd apps/api
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/<local> npx prisma migrate deploy --config prisma7.config.ts
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/<local> npm run db:pull
```
Expected: `git diff apps/api/prisma/schema.prisma` shows only the new model and its relations. If it shows anything else, the local database has drifted, so stop and reconcile.

Mirror the table in `database/dvote_schema.sql`, and run `npm run build` in `apps/api`.

- [ ] **Step 7: Commit**

Suggested message: `feat(api): add scanner pairings table and token helpers`

---

### Task 2: Create, list, disconnect and claim pairings

**Files:**
- Create: `apps/api/src/scanner/scanner.service.ts`, `scanner.controllers.ts`, `scanner.module.ts`, `dto/scanner.dto.ts`
- Modify: `apps/api/src/app.module.ts`, `apps/api/src/rate-limit/rate-limit.ts`
- Test: `apps/api/test/scanner-pairing.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 1 helpers and model.
- Produces, on `ScannerService`:
  - `create(ctx: StaffContext, branchId: string): Promise<{id, secret, code, branchName, expiresAt, expiresInSeconds}>`
  - `list(ctx: StaffContext): Promise<ScannerPairingView[]>`
  - `disconnect(ctx: StaffContext, id: string): Promise<void>`
  - `claim(secret: string, code: string, deviceLabel?: string): Promise<{sessionToken, expiresAt}>`
- Produces: `ScannerPairingView = {id, state: 'pending' | 'active' | 'paused', pauseReason: string | null, deviceLabel, branchId, branchName, staffName, claimedAt, sessionExpiresAt, lastUsedAt}`
- Produces: `LIMITS.pairClaim = 10`, applied per IP the same way `merchant-signup` applies `LIMITS.signup`

- [ ] **Step 1: Write the failing e2e tests**

Follow the setup in `test/redeem.e2e-spec.ts`: seed two vendors, branches and staff, with signed test tokens.

```ts
it('pairs once with the right code');           // 201 code + secret; claim 200; token matches /^dvs_/
it('never stores the secret, code or token');   // row hashes differ from the plain values
it('cancels after 5 wrong tries');              // 5 x 400 pairing_invalid; right code then also 400
it('rejects an expired code');                  // set code_expires_at in the past; 400 pairing_invalid
it('rejects a reused code without touching the paired phone'); // second claim 400; first token still works on GET /scans/today
it('gives one session to two simultaneous right claims');      // Promise.all: one 200, one 400
it('answers the same for every failure');       // unknown secret, wrong code, expired, used: identical status and body
it('replacing a code cancels only the unclaimed one');         // old code 400; a paired phone keeps working
it('limits who can pair');                      // viewer 403 forbidden_role; staff at another branch 403 forbidden_branch; closed or foreign branch 400 invalid_branch
it('scopes the list and disconnect');           // staff: own; manager: branch; admin: shop; other shop's id 404
it('shows a blocked state for paused phones');  // close the branch; list shows state paused, pauseReason branch_closed
it('disconnect records who and why');           // revoked_reason disconnected, revoked_by_staff_id set
```

The session-token assertions above depend on Task 3. Mark them `it.todo` for now, and enable them in Task 3.

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/api && TEST_DATABASE_URL=<local> npm run test:e2e -- scanner-pairing`
Expected: FAIL with 404s on the new routes.

- [ ] **Step 3: Implement the service and controllers**

Routes:
- `/api/vendor/scanner-pairings`: `@VendorApi` and `@StaffRoles('vendor_admin', 'branch_manager', 'staff')`
- `POST /api/public/scanner-pairings/claim`: no guard, `@HttpCode(200)`

Decisions the tests don't determine:
- **Claim** runs in a transaction: `SELECT ... WHERE secret_hash = $1 FOR UPDATE`. It passes only if the row is unclaimed, not revoked, unexpired, under 5 failures, and `sameHash` matches. Otherwise it increments `failed_attempts` if a usable row exists, commits, and then throws. Never throw inside the transaction, or the count rolls back.
- **Replacing a code:** `create` sets `code_expires_at = now()` on the same person's unclaimed rows.
- **5th failure:** an unclaimed row with `failed_attempts >= 5` counts as cancelled. It doesn't use `revoked_at`, because the reasons list is for sessions.
- **List** returns unexpired pending rows and unrevoked, unexpired sessions, with `paused` derived from the shop and branch using the same rules as the shared check in Task 3.
- **`expiresInSeconds`** drives the countdown, so a wrong laptop clock can't break it.

- [ ] **Step 4: Run to verify they pass**

Same command. Expected: PASS, apart from the todos.

- [ ] **Step 5: Commit**

Suggested message: `feat(api): create, list, disconnect and claim phone pairings`

---

### Task 3: Let session tokens scan, and nothing else

**Files:**
- Create: `apps/api/src/auth/staff-access.ts`, `apps/api/src/scanner/scanner-session.guard.ts`, `apps/api/src/scanner/staff-or-scanner.guard.ts`, `apps/api/src/scanner/scanner-me.controller.ts`
- Modify: `apps/api/src/auth/staff-auth.guard.ts`, `apps/api/src/scans/scans.controller.ts`, `apps/api/src/scans/scans.module.ts`, `apps/api/src/rate-limit/rate-limit.ts`, `apps/api/src/scanner/scanner.module.ts`, `apps/api/src/scanner/scanner.service.ts`
- Test: `apps/api/test/scanner-pairing.e2e-spec.ts`, `apps/api/src/rate-limit` spec if one exists

**Interfaces:**
- Consumes: Task 2's `claim`, and `StaffService.me(ctx)`.
- Produces: `assertStaffCanWork(staff: StaffWithVendorAndBranch, allowed?: staff_role[]): void` in `staff-access.ts`. This is the body moved from `StaffAuthGuard`, keeping its order and codes.
- Produces: `assertPairingBranchOpen(pairing)`, which throws 403 `branch_closed` even for merchant admins, whose context has no branch of their own.
- Produces: `ScannerSessionGuard`, which sets `req.staff` and `req.scannerPairingId`.
- Produces: `StaffOrScannerGuard`, which sends tokens starting with `dvs_` to `ScannerSessionGuard` and everything else to `StaffAuthGuard`.

- [ ] **Step 1: Enable Task 2's todos and write the failing tests**

```ts
it('collects and redeems from a phone');        // ledger staff_id = the person who paired, branch_id = the pairing's
it('rejects a session token everywhere else');  // /customers, /staff, /staff/me, /profile, /reports → 401 invalid or missing token
it('keeps a merchant admin phone on its branch'); // other branchId or previewBranchId → 403 forbidden_branch; none sent → uses the pairing's branch
it('ends at 12 hours, even while paused');      // session_expires_at past → 401, reason expired
it('ends on Disconnect and on End session');    // 401 with reason; DELETE /scanner/me also works while paused
it.each(['vendor_suspended', 'trial_ended', 'subscription_expired', 'branch_closed'])(
  'pauses on %s and resumes on the same token'); // 403 code, then 200 after clearing
it('returns only the pairing branch from /scanner/me'); // branch and branches[0] match; branches length 1
it('counts scan limits per phone');             // userTracker: two dvs_ tokens give two keys, same token one key
it('keeps a normal staff login working on scans'); // Supabase token unchanged
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/api && TEST_DATABASE_URL=<local> npm run test:e2e -- scanner-pairing`
Expected: FAIL.

- [ ] **Step 3: Move the shared checks into `assertStaffCanWork`**

Run the existing `StaffAuthGuard` tests unchanged: `npm run test:e2e -- staff`. Expected: PASS, proving the move changed nothing.

- [ ] **Step 4: Implement the guards and `/api/vendor/scanner/me`**

`ScannerSessionGuard` steps, in order:
1. Find the pairing by `sha256(token)`. No row gives 401 `scanner_session_ended` with no reason.
2. A revoked row gives 401 with `reason: revoked_reason`. A past `session_expires_at` gives 401 with `reason: 'expired'`.
3. Safety net, checked before any pause. Each case revokes and returns 401:
   - staff not active: `staff_disabled`
   - role is `viewer`: `role_changed`
   - `staff.branch_id` set and different from the pairing's: `branch_changed`
4. `DELETE /scanner/me` stops here, so a paused phone can still end its session.
5. `assertStaffCanWork`, then `assertPairingBranchOpen`.
6. Branch lock: if `body.branchId` or `body.previewBranchId` differs from the pairing's, throw 403 `forbidden_branch`. If `body.branchId` is absent on a POST, set it to the pairing's.
7. Set `req.staff` with `branchId` from the pairing. Update `last_used_at` only if it's over a minute old.

`GET /scanner/me` returns `StaffService.me(ctx)` with `branch` and `branches` replaced by the pairing's branch.

`userTracker` returns `scanner:` plus the first 16 characters of `sha256(token)` for `dvs_` tokens.

Change `ScansController` to `@UseGuards(StaffOrScannerGuard)`. Leave `@StaffRoles` as it is.

- [ ] **Step 5: Run to verify they pass**

Same command as Step 2. Expected: PASS. Also run `npm run test:e2e -- "collect|redeem"`. Expected: PASS.

- [ ] **Step 6: Commit**

Suggested message: `feat(api): let paired phones scan through a limited session`

---

### Task 4: End sessions on staff changes, and clean up on purge

**Files:**
- Create: `apps/api/src/scanner/revoke-for-staff-change.ts`
- Modify: `apps/api/src/staff/staff.service.ts:202-220,245`, `apps/api/src/trial/trial.service.ts:310-345`
- Test: `apps/api/test/scanner-pairing.e2e-spec.ts`

**Interfaces:**
- Produces: `revokeForStaffChange(tx: Prisma.TransactionClient, before: {id, status, role, branch_id}, after: {status, role, branch_id}): Promise<void>`
  - It does nothing if nothing relevant changed.
  - The reason priority is `staff_disabled`, then `role_changed`, then `branch_changed`.
  - It revokes unclaimed codes as well as sessions.

- [ ] **Step 1: Write the failing tests**

```ts
it('ends for good when staff are disabled and stays ended after re-enabling'); // merchant route
it('ends when a platform admin disables the staff member');   // PATCH /api/admin/staff/:id
it('ends on a role change');                                  // 401 reason role_changed
it('ends on a branch move, and stays ended after moving back'); // 401 reason branch_changed
it('does not end when only the name changes');                // still 200
it('cancels an unclaimed code when staff are disabled');      // claim → 400 pairing_invalid
it('purges a trial shop that has pairings');                  // purge succeeds, no rows left
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/api && TEST_DATABASE_URL=<local> npm run test:e2e -- scanner-pairing`
Expected: FAIL.

- [ ] **Step 3: Implement `revokeForStaffChange` and call it in all three write paths**

`StaffService.update` and `adminUpdate` must both wrap the staff write and the revoke in one `$transaction`. In `purge()`, add `DELETE FROM scanner_pairings WHERE vendor_id = ${id}::uuid` before the staff and branch deletes.

- [ ] **Step 4: Run to verify they pass**

Same command, then `npm run test:e2e -- "staff|trial"`. Expected: PASS.

- [ ] **Step 5: Commit**

Suggested message: `feat(api): end phone sessions when staff change`

---

### Task 5: Pair a phone from the Scan page

**Files:**
- Create: `apps/dashboard/src/pages/my/pair-phone.tsx`
- Modify: `apps/dashboard/src/pages/my/MyTill.tsx`, `apps/dashboard/src/lib/api.ts`, `apps/dashboard/src/i18n/en.ts`, `ar.ts`
- Test: `apps/ui-tests/lib/mock-api.ts`, `apps/ui-tests/lib/fixtures.ts`, `apps/ui-tests/tests/dialogs.spec.ts`, `dashboard-merchant.spec.ts`

**Interfaces:**
- Consumes: Task 2's routes.
- Produces, on `createVendorApi`: `createPairing(branchId)`, `scannerPairings()`, `disconnectPairing(id)`
- Produces: `<PairPhone branchId={string | null} />`, which renders the button, dialog and Paired phones list

- [ ] **Step 1: Write the failing UI tests**

```ts
test('pair dialog shows the QR, code, branch and countdown');   // on /scan: click Pair a phone; code matches /^\d{6}$/
test('dialog says connected once the phone pairs');             // mock list returns state active
test('paired phones list disconnects a phone');                 // calls DELETE, row disappears
test('paused phone shows a blocked state');                     // pauseReason branch_closed
test('Pair a phone is disabled until a branch is picked');      // merchant admin with 2 branches
test('dialog fits at phone widths and in Arabic');              // existing audit helpers
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/ui-tests && npm test -- dialogs dashboard-merchant`
Expected: FAIL, the button isn't there.

- [ ] **Step 3: Implement `pair-phone.tsx` and add it to `MyTill`**

- The QR value is `${config.merchantUrl || location.origin}/pair#${secret}`, with `qrcode.react`.
- Show the code with `dir="ltr"`, and count down from `expiresInSeconds`. On zero, offer a new code.
- Poll `scannerPairings` every 3 seconds while the dialog is open, otherwise every 30 seconds.
- Hide the whole control when `useWorkspace()` is set, because admins can't pair.
- Add `pair.*` and `errors.pairing_invalid` keys in both languages.

- [ ] **Step 4: Run to verify they pass**

Same command, then `cd apps/dashboard && npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

Suggested message: `feat(dashboard): pair a phone from the Scan page`

---

### Task 6: The phone scanner page

**Files:**
- Create: `apps/dashboard/src/pages/pair/pair-page.tsx`, `apps/dashboard/src/lib/scanner-session.ts`
- Modify: `apps/dashboard/src/router.tsx`, `apps/dashboard/src/lib/api.ts`, `apps/dashboard/src/pages/my/MyTill.tsx`, `apps/dashboard/src/i18n/en.ts`, `ar.ts`
- Test: `apps/ui-tests/tests/pair-phone.spec.ts`, `apps/ui-tests/lib/mock-api.ts`, and a unit test for `normalizeCode` if the dashboard has a unit runner, otherwise through the UI test

**Interfaces:**
- Consumes: Task 3's routes and `VendorWorkspaceProvider({client, me})`.
- Produces: `createVendorApi(prefix = '/api/vendor', options?: { token: () => string | null; onError?: (e: ApiError) => void })`. With `options`, `call` uses that token and never reads the Supabase session.
- Produces: `MyTill({ phone = false })`. With `phone`, it hides the Activity link and `PairPhone`, and turns off the branches query.
- Produces: `normalizeCode(input: string): string` in `scanner-session.ts`, which converts `٠-٩` to `0-9` and strips everything else.
- Produces: `scannerSession.get() / set(token) / clear()`, using `localStorage` key `dvote-scanner-session`.

- [ ] **Step 1: Write the failing UI tests**

Run the mock API with its fake camera path, typing codes through the till's manual entry.

```ts
test('pairs with the code and opens the scanner');            // /pair#secret; enter code; Scan button visible
test('removes the secret from the address bar');              // location.hash === '' after loading
test('shows no shop name before the code is accepted');
test('accepts Arabic digits and pasted spaces');              // '٤٢٧٩١٠' and '427 910' claim as '427910'
test('wrong code shows one message and stays on the form');   // pairing_invalid
test('uses the session token, not a dashboard session');      // seed a fake Supabase session; every /scans call has Bearer dvs_...
test('resumes after a reload with no code');                  // reload /pair; Scan button visible
test('network loss keeps the session');                       // abort requests; offline error shown; token still stored
test('ended session clears the token and asks to pair again'); // 401 scanner_session_ended reason disconnected
test('paused session shows why, then resumes');               // 403 branch_closed, then 200 after retry
test('End session clears the token and calls DELETE');
test('hides the Activity link');
test('fits at phone widths and in Arabic');                   // existing audit helpers
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/ui-tests && npm test -- pair-phone`
Expected: FAIL.

- [ ] **Step 3: Implement it**

In `Shell`, return `<PairPage />` for `/pair` before the status checks, next to `/set-password`, unless `site === 'admin'`.

Page states:
- `entry`: a secret was in the hash. A new pairing replaces any stored session.
- `loading`, then `scanner`: a token is stored. Wrap `MyTill phone` in `VendorWorkspaceProvider`, with a header holding the language switch and End session.
- `paused`: show the message for that code, retry `GET /scanner/me` every 30 seconds, and offer Try again.
- `ended`: clear the token and ask to pair again.
- `nothing`: no secret and no token. Ask to scan the QR on the Scan page.

`onError` moves to `ended` on `scanner_session_ended`, and to `paused` on the four pause codes. All other errors, including `network`, stay where they are.

Pass the reason through `call`, following the `planErrorText` pattern: `errors.scanner_session_ended_<reason>`, falling back to `errors.scanner_session_ended`.

Derive `deviceLabel` from the user agent as `iPhone`, `Android` or `Phone`.

- [ ] **Step 4: Run to verify they pass**

Same command, then `npm run ui:test` from the repo root. Expected: PASS, with the responsive checks still green.

- [ ] **Step 5: Commit**

Suggested message: `feat(dashboard): add the phone scanner page`

---

### Task 7: Docs and final checks

**Files:**
- Modify: `CLAUDE.md`, `DVOTE_BRIEF.md`, `DEPLOY.md`, `docs/go-live-checklist.md`

- [ ] **Step 1: Document it**

- `CLAUDE.md`: a "Built" section with routes, codes, the guard and the split between ending and pausing.
- `DVOTE_BRIEF.md`: a status line and a decisions log row.
- `DEPLOY.md`: phone pairing in step 10's checks.
- `docs/go-live-checklist.md`: mark "Use on your phone" done, add real-phone pairing to the Scan page blockers, and mark the staff app as not at launch.
- **Park the staff app (decided 2026-11-05):** remove "or the staff app" from `apps/dashboard/src/i18n/en.ts` and `ar.ts` (team setup hint and `roleHint`), change the staff app row in `DEPLOY.md`, and note in `CLAUDE.md` and `DVOTE_BRIEF.md` that the code stays in the repo but doesn't ship at launch.

- [ ] **Step 2: Run everything**

```bash
cd apps/api && npm test && TEST_DATABASE_URL=<local> npm run test:e2e
cd apps/dashboard && npm run build
npm run ui:test
```
Expected: all pass. Report any failures with their output.

- [ ] **Step 3: Check it in the browser**

Start `api` and `dashboard` from `.claude/launch.json`. This needs a working database, so if the Supabase connection is still failing, use a local database for this check. Pair in one tab and open the QR's link in another, then take a screenshot of each.

- [ ] **Step 4: Ask before touching Supabase**

Tell the user the migration is ready, and ask for approval to apply `34_scanner_pairings` and re-run `database/supabase_lockdown.sql` on the shared project. Don't apply it without a clear yes.

- [ ] **Step 5: Test on real phones**

Android and iPhone browsers over HTTPS, on staging or a tunnel. If this can't be done yet, say so plainly in the handoff, because the checklist keeps it as a launch blocker.

- [ ] **Step 6: Commit**

Suggested message: `docs: document phone scanner pairing`
