-- Link customers to their Supabase Auth account (auth.users.id in the Supabase project).
-- Nullable so rows created before Supabase (e.g. seed data) stay valid; UNIQUE ignores NULLs.
-- Idempotent so it is safe on databases built from the updated database/dvote_schema.sql.
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_key ON users (auth_user_id);
