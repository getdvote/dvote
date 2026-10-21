-- Customer profile: optional gender and birthday (edited in the app's Profile details).
-- birth_date is a plain date (no time / time zone). NULL = not given. The API also rejects
-- future dates; the CHECK only stops nonsense years.
-- Idempotent so it is safe on databases built from the updated database/dvote_schema.sql.
DO $$
BEGIN
    CREATE TYPE user_gender AS ENUM ('male', 'female');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS gender user_gender;
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date date;

DO $$
BEGIN
    ALTER TABLE users ADD CONSTRAINT users_birth_date_ck CHECK (birth_date >= DATE '1900-01-01');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
