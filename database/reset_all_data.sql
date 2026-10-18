-- =====================================================================
-- dvote: EMPTY THE WHOLE DATABASE (start from zero, e.g. before launch)
-- =====================================================================
-- Deletes EVERY row in every app table (merchants, branches, staff,
-- customers, cards, points ledger, rewards, feedback, broadcasts, ...).
-- Keeps the structure: tables, indexes, triggers, the migrations history
-- (_prisma_migrations), and the Supabase lockdown (RLS) all stay.
-- This CANNOT be undone. Take a backup first if anything matters.
--
-- How to run (Supabase dashboard → SQL Editor), all in ONE run:
--   1. Paste this whole file.
--   2. Change the confirm line just below to:
--        SET LOCAL dvote.reset_confirm = 'yes-delete-everything';
--   3. Run. Without that exact text nothing is deleted.
--
-- Not covered by this script (do these in the Supabase dashboard):
--   - Sign-in accounts: optional part B at the bottom (auth.users).
--   - Uploaded images: Storage → buckets `vendors` and `avatars` →
--     select all → Delete (Supabase blocks deleting files from SQL).
-- After it: create the platform admin again:
--   npm --prefix apps/api run admin:create -- --name "dvote" --email <email> --password "<pw>"
-- =====================================================================

BEGIN;

SET LOCAL dvote.reset_confirm = 'no';   -- ← change 'no' to 'yes-delete-everything'

DO $$
DECLARE
  tables text;
BEGIN
  IF current_setting('dvote.reset_confirm', true) IS DISTINCT FROM 'yes-delete-everything' THEN
    RAISE EXCEPTION 'Not confirmed: set dvote.reset_confirm to yes-delete-everything. Nothing was deleted.';
  END IF;

  -- every table in the app schema except Prisma's migrations history
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
    INTO tables
    FROM pg_tables
   WHERE schemaname = 'public'
     AND tablename <> '_prisma_migrations';

  IF tables IS NULL THEN
    RAISE NOTICE 'No tables found.';
    RETURN;
  END IF;

  -- TRUNCATE skips the row triggers (the ledger''s no-delete rule is for DELETE/UPDATE)
  -- and CASCADE empties tables that point at each other in one go.
  EXECUTE 'TRUNCATE ' || tables || ' RESTART IDENTITY CASCADE';
  RAISE NOTICE 'Emptied: %', tables;
END $$;

-- ---------------------------------------------------------------------
-- Part B (optional): delete every Supabase sign-in account too
-- (staff, merchant admins, platform admins, app customers).
-- Remove the two dashes at the start of the next line to include it.
-- DELETE FROM auth.users;
-- ---------------------------------------------------------------------

COMMIT;

-- Check: every count should be 0 (run separately afterwards if you like)
-- SELECT relname AS table, n_live_tup AS rows FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY relname;
