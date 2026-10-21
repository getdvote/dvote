# Supabase email templates (English + Arabic)

Supabase has one template per email type (not one per language), so each email carries both languages.
Paste them in **Supabase → Authentication → Emails → Templates**. Keep the `{{ … }}` parts exactly as they are: `{{ .ConfirmationURL }}` is the link, `{{ .Token }}` the code.

All six share one dvote layout: ink background with the symbol pattern, electric logo, a white card with an **animated illustration card** (GIF), the headline in Barlow Condensed with the hand-drawn underline, electric button, then the Arabic half, then the "Good things come back." footer.

| Template in Supabase | Subject (paste in "Subject heading") | Body (paste the whole file in "Message body") |
|---|---|---|
| **Invite user** | `You're invited to {{ if .Data.shop_name }}{{ .Data.shop_name }} on {{ end }}dvote · دعوة للانضمام إلى dvote` | [invite.html](invite.html) |
| **Reset password** | `Reset your dvote password · إعادة تعيين كلمة المرور` | [reset-password.html](reset-password.html) |
| **Confirm signup** | `Confirm your dvote email · تأكيد بريدك على dvote` | [confirm-signup.html](confirm-signup.html) |
| **Magic link** | `Your dvote sign-in link · رابط تسجيل الدخول إلى dvote` | [magic-link.html](magic-link.html) |
| **Change email address** | `Confirm your new dvote email · تأكيد بريدك الجديد` | [change-email.html](change-email.html) |
| **Reauthentication** | `Your dvote security code · رمز الأمان` | [reauthentication.html](reauthentication.html) |

- **Deploy the customer website first.** The images load from `https://dvote.co/email/…` (files in `apps/web/public/email/`). Until `apps/web` is deployed with them, the emails show broken images.
- The invite uses details the API sends with each staff invite (`apps/api/src/staff/staff.service.ts` → `inviteUser`): `full_name`, `shop_name`, `role_en`, `role_ar`. Invites without them fall back to a general text.
- The 24-hour / 1-hour link lifetimes in the text match Supabase's defaults; change the text if you change **Authentication → Settings → Email OTP expiration**.
- Test after saving: invite yourself from the dashboard (Settings → Team), and use "Forgot password" on the sign-in page.

## Editing

Don't edit the `.html` files by hand: they are generated.

- Text and layout: `src/build-templates.mjs` → `node docs/email-templates/src/build-templates.mjs` (writes the six templates and `preview/*.html` with sample data).
- Images and animations: `src/build-assets.mjs` → `node docs/email-templates/src/build-assets.mjs` (writes `apps/web/public/email/`: one animated GIF per template, the pattern tile, logo, symbol and underline). Shapes come from the brand kit illustrations; uses `sharp` from `apps/api`.

Animated GIFs play in Gmail, Apple Mail, iOS and Android mail. Outlook on Windows shows only the first frame, so each GIF starts on its finished picture.
