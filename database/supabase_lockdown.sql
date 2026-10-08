-- =====================================================================
--  Supabase only: close the Data API (PostgREST) over our tables.
--
--  The publishable key ships inside every app, and Supabase exposes the
--  `public` schema through its REST API to the `anon` / `authenticated`
--  roles. dvote never uses that API: only NestJS reads the database, as
--  the table owner (`postgres`), which RLS does not restrict.
--
--  So: RLS on with no policies + no grants for the API roles = the REST
--  API sees nothing. Run once after creating the schema, and again after
--  any migration that adds a table. Not for the local database (the
--  anon/authenticated roles only exist on Supabase).
-- =====================================================================

DO $$
DECLARE t record;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    END LOOP;
END $$;

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- tables created later (migrations run as postgres) get no API grants either
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
