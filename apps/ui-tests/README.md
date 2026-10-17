# ui-tests: responsive layout checks

Playwright opens every page of the **dashboard** (merchant admin, branch manager, cashier and platform admin) and the **customer website** at 9 screen sizes — 320, 375 and 430 px phones, 768 px tablet, 1024 px tablet landscape, a short 1280 × 640 laptop, 1440, 1920 and 2560 px — plus Arabic (right to left) at 4 of them, and the main dialogs (scan modal with both tabs, reward form, QR poster, date picker, phone menu).

On each one it checks:

| Check | Fails when |
|---|---|
| `page-overflow` | the page scrolls sideways |
| `offscreen` | something visible sticks out of the window (not inside its own scroll box) |
| `overlap` | two controls cover each other (only the parts you can actually see count) |
| `tap-target` | a control is smaller than 24 × 24 px on a phone (WCAG 2.5.8; links inside a sentence are exempt) |
| `clipped-text` | a button, tab, badge or header cuts its own text without an ellipsis |
| `dialog-fit` | an open dialog / popover doesn't fit the window and can't scroll |

No real accounts or data: the apps run on their own dev servers (ports 5199 / 5198) against a fake API host whose answers come from `lib/fixtures.ts` — typed with the apps' own API types, with deliberately long names, Arabic text and large numbers. A fake Supabase session signs the dashboard in.

```bash
npm install && npx playwright install chromium   # once
npm test                                         # everything (~4 min)
npm run summary                                  # findings of the last run, grouped
npx playwright test -g "phone-small-320"         # one size
npm run report                                   # HTML report with a screenshot of every page
```

A page with findings also leaves a full-page screenshot in `test-results/shots/`. When a page needs a new endpoint, add it to `lib/mock-api.ts` (unmocked GETs return 404 `not_mocked`); when an API type changes, `npm run typecheck` points at the fixture to update.
