# Supabase email templates (English + Arabic)

Supabase has one template per email type (not one per language), so each email carries both languages.
Paste them in **Supabase → Authentication → Emails → Templates**. Keep `{{ .ConfirmationURL }}` exactly as it is: it is the link.

| Template in Supabase | Subject (paste in "Subject heading") | Body (paste the whole file in "Message body") |
|---|---|---|
| **Invite user** | `You're invited to {{ if .Data.shop_name }}{{ .Data.shop_name }} on {{ end }}dvote · دعوة للانضمام إلى dvote` | [invite.html](invite.html) |
| **Confirm signup** (merchant self sign-up) | `Confirm your email to start your dvote free trial · أكّد بريدك لبدء تجربتك المجانية` | [confirm-signup.html](confirm-signup.html) |
| **Reset password** | `Reset your dvote password · إعادة تعيين كلمة المرور` | [reset-password.html](reset-password.html) |

- The invite uses details the API sends with each staff invite (`apps/api/src/staff/staff.service.ts` → `inviteUser`): `full_name`, `shop_name`, `role_en`, `role_ar`. Invites without them (e.g. `npm run admin:create` without a password) fall back to a general text.
- The 24-hour / 1-hour link lifetimes in the text match Supabase's defaults; change the text if you change **Authentication → Settings → Email OTP expiration**.
- Test after saving: invite yourself from the dashboard (Settings → Team), and use "Forgot password" on the sign-in page.
- Other templates (Confirm signup, Magic link, Change email) are not used by the dashboard or the staff app right now.
