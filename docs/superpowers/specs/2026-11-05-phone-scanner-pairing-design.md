# Phone scanner pairing: design

Date: 2026-11-05. Status: awaiting approval.

## Intent

A cashier working on a laptop often has no good camera at the till, and customers show their Wallet QR at the counter. The merchant wants to turn any phone into the scanner in seconds: open the Scan page, scan a QR with the phone, type a 6-digit code, and start scanning, without an email or password on the phone.

## Goals

- Pair a phone from the dashboard Scan page in under 30 seconds.
- The phone does exactly what the dashboard Scan page does: collect points and give rewards.
- Keep every scan attributed to a staff member, in the same branch, under the same business rules.
- Let the shop cut off a phone at any time.

## Non-goals

- Live handoff, where the phone scans and the laptop shows the customer. Each device runs its own scan flow.
- Telling apart several cashiers using phones paired by one person.
- Changes to the Expo staff app.
- Pairing from the platform admin's merchant workspace.
- A limit on the number of paired phones, or any plan gating.

## Anti-goals (a failure even if it works)

- A permanent or reusable link that signs anyone in.
- A paired phone reaching anything other than scanning: customer lists, reports, settings, staff.
- A phone that scans while its staff member is disabled or the shop is locked, or after someone pressed Disconnect.
- A phone that comes back by itself after a change to its staff member.
- A code that can be guessed by script.

## Decided by the merchant

- The option lives on the Scan page and shows a QR code.
- The QR opens the merchant scanner on the phone.
- A 6-digit code confirms the pairing, with no sign-in on the phone.
- The phone scans like the dashboard scanner.
- A paired phone stays paired for 12 hours.
- Scans count under the person who paired the phone.
- The phone uses the branch selected on the laptop.
- Anyone who can use the Scan page can pair. Viewers cannot.
- Paired phones are listed with a Disconnect button.
- The code expires after 5 minutes, works once, and is cancelled after 5 wrong tries.
- Staff changes end a phone's session for good. Shop and branch locks only pause it.

## User flow

**Laptop**

1. On the Scan page, the person presses **Pair a phone**. It's disabled until a branch is selected, like the scan buttons.
2. A dialog shows the QR, the 6-digit code, the branch name and a 5-minute countdown. When the code expires, the dialog offers a new one.
3. When a phone connects, the dialog says so and the phone appears under **Paired phones**.

**Phone**

1. The camera opens `https://merchant.dvote.co/pair#<secret>`.
2. The page shows the shop and branch name after the code is accepted, and before that only a 6-digit entry field and a language switch.
3. A correct code opens the scanner: the existing scan, amount, reward and result steps.
4. When the session ends, the phone shows why and asks the person to pair again.
5. When the session is paused, the phone shows why, keeps its session and tries again by itself. It also offers a **Try again** button.

**Ending a session, so the phone must pair again:** Disconnect on the laptop, the 12-hour limit, the phone's own **End session** button, or a change to the staff member: disabled, role changed or moved to another branch.

**Pausing a session, so the phone resumes when it clears:** the shop is suspended, the trial has ended, the subscription has expired or the branch is closed. The 12-hour limit keeps running during a pause.

## Security model

There are three secrets with different jobs:

| Secret | Where it lives | Purpose |
|---|---|---|
| Pair secret | 128-bit random, in the QR's URL fragment | Identifies the pairing and can't be guessed. The fragment stays out of server and proxy logs |
| 6-digit code | On the laptop screen only | Proves the person can see the laptop. It's never in the QR |
| Session token | 256-bit random, in the phone's `localStorage` | Authorises scanning for up to 12 hours |

Store only the SHA-256 of the pair secret and session token. Store the code as SHA-256 of secret + code, and compare in constant time. Never log any of the three.

Counting wrong tries must be atomic. The 5th wrong try cancels the pairing, and two simultaneous correct claims must produce one session. Every failed claim returns the same error code whether the secret is unknown, expired, cancelled or the code is wrong, so the endpoint reveals nothing. Limit claims to 10 per minute per IP.

**Accepted risks**

- Anyone who can see the laptop screen during the 5 minutes could pair a phone.
- Someone holding the phone during the 12 hours can scan and see what the Scan page shows, including customer names and balances. Disconnect is the remedy.

## Rules

**Same checks as a signed-in person, on every request.** Reuse the `StaffAuthGuard` checks rather than copying them: staff active, role allowed, shop active, trial not ended, subscription not expired, branch open. Move them into a shared function.

**Staff changes end the session for good.** Every code path that disables a staff member, changes their role or moves them to another branch revokes their pairings in the same transaction, on both the merchant and platform admin routes. Re-enabling the person later does not bring a phone back. As a safety net, if the session guard finds a mismatch with the pairing, such as a different branch, it revokes the pairing too.

**Shop and branch locks only pause it.** These write nothing to the pairing. The request gets the existing 403 code, and access returns when the lock clears.

**Deleting a shop.** `TrialService.purge()` must also delete the shop's `scanner_pairings`, in the right order.

**Scope.** The session token works only on:

- `POST /api/vendor/scans/preview`, `collect` and `redeem`
- `GET /api/vendor/scans/today`
- `GET /api/vendor/scanner/me`
- `DELETE /api/vendor/scanner/me` (the phone's End session)

Every other route must reject it, because `StaffAuthGuard` still verifies Supabase tokens only.

**Branch lock.** A merchant admin's context normally has no branch and can send any `branchId`. For a phone session, the context's branch comes from the pairing, and any request naming a different branch gets 403 `forbidden_branch`. The check for a closed branch applies to the pairing's branch, including for merchant admins.

**Rate limits.** The scan limit of 60 per minute applies per paired phone. Today the limiter reads a JWT `sub`, so it needs a key for session tokens, such as `scanner:<id>`. Otherwise all phones behind one IP share a bucket.

**Who manages phones.** A person sees and disconnects phones they paired. A merchant admin sees and disconnects all of the shop's phones, and a branch manager those of their branch.

**Replacing a code.** Requesting a new code cancels that person's previous unclaimed code. It never affects phones already paired.

**Ledger.** No ledger change. `staff_id` is the person who paired, `branch_id` is the pairing's branch, and scan sources stay as they are.

## Data

Migration `34_scanner_pairings`, new table `scanner_pairings`:

- `id`, `vendor_id`, `branch_id` (composite FK with vendor), `staff_id` (composite FK with vendor), `created_at`, `updated_at`
- `secret_hash` (unique), `code_hash`, `code_expires_at`, `failed_attempts`
- `session_token_hash` (unique, null until claimed), `claimed_at`, `session_expires_at`
- `revoked_at`, `revoked_by_staff_id`, `revoked_reason`, `device_label`, `last_used_at`

`revoked_reason` is one of `disconnected`, `ended_by_phone`, `staff_disabled`, `role_changed` or `branch_changed`. Status is derived from these columns, and a pause is worked out from the shop and branch at read time. Rows are kept as the record of who paired what and when. RLS follows the rest of the schema: re-run `database/supabase_lockdown.sql`, and mirror the table in `database/dvote_schema.sql`.

Apply to the local test database first. **Applying to the shared Supabase project needs the merchant's explicit approval.**

## API

| Method and path | Auth | Purpose |
|---|---|---|
| `POST /api/vendor/scanner-pairings {branchId}` | Staff, 3 scanning roles | Creates a pairing, returns `{id, secret, code, branchName, expiresAt}`. The only time the code and secret are returned |
| `GET /api/vendor/scanner-pairings` | Same | Lists active phones, plus pending pairing state for the dialog |
| `DELETE /api/vendor/scanner-pairings/:id` | Same, scoped as above | Disconnect. Other shops' rows return 404 |
| `POST /api/public/scanner-pairings/claim {secret, code, deviceLabel?}` | None | Returns `{sessionToken, expiresAt}`. Errors: `pairing_invalid`, `rate_limited` |
| `GET /api/vendor/scanner/me` | Session token | Returns the `StaffMe` fields the Scan page needs, with `branches` holding only the pairing's branch |
| `DELETE /api/vendor/scanner/me` | Session token | Ends the session |

Session errors:

- **Ended:** 401 `scanner_session_ended`, with a `reason` of `expired` or the `revoked_reason`. An unknown token gets the same code with no reason. The phone clears its token and asks to pair again.
- **Paused:** the existing 403 codes `vendor_suspended`, `trial_ended`, `subscription_expired` and `branch_closed`. The phone keeps its token and shows the blocked state.

`GET /api/vendor/scanner-pairings` returns each phone's state, including paused with its reason, so **Paired phones** shows a blocked state instead of looking active.

## Dashboard

- **Scan page:** a **Pair a phone** control, the pairing dialog and a **Paired phones** list. Use `qrcode.react`, which is already installed. The QR's base URL comes from `config.merchantUrl`, falling back to the current origin in local development.
- **New public route `/pair`:** handled in `Shell` before the sign-in check, like `/set-password`, so it works whether or not the browser has a dashboard session. It must use the session token and ignore any Supabase session.
- **Reuse the Scan page, don't fork it.** `VendorWorkspaceProvider` already lets a screen run on a different API client and `me`. Give it a client that sends the session token, and split `MyTill` where needed so the phone gets the same steps. Links out of the till, such as the daily summary's link to Activity, must be hidden on the phone.
- **Text:** English and Arabic with RTL, using the existing `src/i18n` rules. New error codes go under `errors.*`.
- **Camera:** reuse `QrScanner` and `CameraBlockedHelp`. Phone cameras need HTTPS, which production has.

## Tests

**API e2e, against the local test database**

- A happy path that collects and redeems, with the ledger's `staff_id` and `branch_id` correct.
- Wrong code 5 times cancels the pairing. Expired code. Reused code. Two simultaneous correct claims give one session.
- A session token rejected on a non-scan route such as customers and staff.
- A session ended for good by Disconnect, the 12-hour limit, the phone's End session, disabled staff, a role change and a branch move, with no recovery when the staff change is reversed.
- A session paused by a closed branch, suspended shop, ended trial and expired subscription, then working again on the same token once each clears.
- A paused session still ends at the 12-hour limit.
- Purging a trial shop with pairings succeeds.
- A merchant admin's phone blocked from another branch.
- Another shop can't list or disconnect a pairing.
- Failed claims all return the same error.

**UI tests:** add the dialog, the Paired phones list and `/pair` to `apps/ui-tests`, at phone widths and in Arabic.

**Real phones:** test Android and iPhone browsers over HTTPS before launch, using a staging deployment or an HTTPS tunnel. The local setup can't test a phone camera over plain HTTP.

## Documentation

Update `CLAUDE.md` and `DVOTE_BRIEF.md` when built, and tick the scanner items in `docs/go-live-checklist.md`.

## Left to the builder

- Exact component structure and how `MyTill` is split.
- How often the dialog polls for a connected phone.
- Wording, in both languages.
- How `device_label` is derived, as long as it's a short name like "iPhone" and stores no full user agent.
- How the session guard is structured, as long as the shared checks have one source.
