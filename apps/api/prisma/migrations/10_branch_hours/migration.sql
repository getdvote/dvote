-- Branch opening hours (optional, the same every day), local time of the branch's timezone.
-- "HH:MM" 24-hour; both set or both NULL. closes_at earlier than opens_at = open past midnight
-- (e.g. 18:00-02:00).
-- Idempotent so it is safe on databases built from the updated database/dvote_schema.sql.
ALTER TABLE branches ADD COLUMN IF NOT EXISTS opens_at  varchar(5);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS closes_at varchar(5);

DO $$ BEGIN
  ALTER TABLE branches ADD CONSTRAINT branches_hours_ck CHECK (
    (opens_at IS NULL AND closes_at IS NULL)
    OR (opens_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        AND closes_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        AND opens_at <> closes_at)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
