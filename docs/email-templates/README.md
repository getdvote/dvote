# Supabase email templates (English + Arabic)

Supabase has one template per email type (not one per language), so each email carries both languages.
Paste them in **Supabase → Authentication → Emails → Templates**. Keep the `{{ … }}` parts exactly as they are: `{{ .ConfirmationURL }}` is the link, `{{ .Token }}` the code.

All six share one dvote layout: espresso background with the symbol pattern, orange logo (coffee palette, brand v2.0), a white card with an **animated illustration card** (GIF), the headline in Barlow Condensed with the hand-drawn underline, orange button with espresso text, then the Arabic half, then the "Good things come back." footer.

| Template in Supabase | Subject (paste in "Subject heading") | Body (paste the whole file in "Message body") |
|---|---|---|
| **Invite user** | `You're invited to {{ if .Data.shop_name }}{{ .Data.shop_name }} on {{ end }}dvote · دعوة للانضمام إلى dvote` | [invite.html](invite.html) |
| **Confirm signup** (merchant self sign-up) | `Confirm your email to start your dvote free trial · أكّد بريدك لبدء تجربتك المجانية` | [confirm-signup.html](confirm-signup.html) |
| **Reset password** | `Reset your dvote password · إعادة تعيين كلمة المرور` | [reset-password.html](reset-password.html) |
| **Magic link** | `Your dvote sign-in link · رابط تسجيل الدخول إلى dvote` | [magic-link.html](magic-link.html) |
| **Change email address** | `Confirm your new dvote email · تأكيد بريدك الجديد` | [change-email.html](change-email.html) |
| **Reauthentication** | `Your dvote security code · رمز الأمان` | [reauthentication.html](reauthentication.html) |

- **Deploy whatever serves `dvote.co` first.** The images load from `https://dvote.co/email/…`. The same files are in `apps/web/public/email/` (serves dvote.co today) and `apps/landing/public/email/` (serves it after the move in DEPLOY.md), so the links survive the switch.
- Confirm signup is the merchant self sign-up (dashboard `Signup.tsx` → free trial): it uses `full_name` and `shop_name`; the shop opens only after the email is confirmed.
- The invite uses details the API sends with each staff invite (`apps/api/src/staff/staff.service.ts` → `inviteUser`): `full_name`, `shop_name`, `role_en`, `role_ar`. Invites without them fall back to a general text.
- The 24-hour / 1-hour link lifetimes in the text match Supabase's defaults; change the text if you change **Authentication → Settings → Email OTP expiration**.
- Test after saving: invite yourself from the dashboard (Settings → Team), and use "Forgot password" on the sign-in page.

## Editing

Don't edit the `.html` files by hand: they are generated.

- Text and layout: `src/build-templates.mjs` → `node docs/email-templates/src/build-templates.mjs` (writes the six templates and `preview/*.html` with sample data).
- Images and animations: `src/build-assets.mjs` → `node docs/email-templates/src/build-assets.mjs` (writes `apps/web/public/email/` and copies it to `apps/landing/public/email/`: one animated GIF per template, the pattern tile, logo, symbol and underline). Shapes come from the brand kit illustrations; uses `sharp` from `apps/api`.

Animated GIFs play in Gmail, Apple Mail, iOS and Android mail. Outlook on Windows shows only the first frame, so each GIF starts on its finished picture.
