-- Vendor contact phone: shown on the merchant's shop profile (dashboard Storefront → Branding).
-- Stored without spaces, optional leading +, 6-15 digits (e.g. +201001234567); NULL = not set.
-- Idempotent so it is safe on databases built from the updated database/dvote_schema.sql.
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS contact_phone varchar(20);

DO $$ BEGIN
  ALTER TABLE vendors ADD CONSTRAINT vendors_contact_phone_ck CHECK (contact_phone ~ '^\+?[0-9]{6,15}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
