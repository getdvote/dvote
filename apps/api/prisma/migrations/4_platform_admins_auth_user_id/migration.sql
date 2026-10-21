-- Platform admins sign in through Supabase Auth (password + authenticator-app 2FA):
-- link each admin row to its Supabase user. Passwords and TOTP secrets now live in Supabase,
-- so password_hash is no longer required and totp_secret_ref is unused (kept for legacy rows).
-- Idempotent so it is safe on databases built from the updated database/dvote_schema.sql.
ALTER TABLE platform_admins ADD COLUMN IF NOT EXISTS auth_user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS platform_admins_auth_user_id_key ON platform_admins (auth_user_id);
ALTER TABLE platform_admins ALTER COLUMN password_hash DROP NOT NULL;
