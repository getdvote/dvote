-- Staff sign in through Supabase Auth: link each staff row to its Supabase user.
-- Passwords now live in Supabase, so password_hash is no longer required (kept for legacy rows).
-- Idempotent so it is safe on databases built from the updated database/dvote_schema.sql.
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS auth_user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS staff_users_auth_user_id_key ON staff_users (auth_user_id);
ALTER TABLE staff_users ALTER COLUMN password_hash DROP NOT NULL;
