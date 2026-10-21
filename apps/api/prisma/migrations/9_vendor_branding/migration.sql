-- Vendor branding: business category, loyalty-card design and a banner image.
-- category: what kind of place it is (shown in the app; NULL = not set).
-- card_design: which of the 10 card designs the vendor's loyalty cards use (NULL = automatic).
-- banner_url / banner_path: shop-page banner, uploaded to Storage bucket "vendors" at
--   <vendorId>/banner/<uuid>.webp (banner_path is set when the file is in Storage).
-- Idempotent so it is safe on databases built from the updated database/dvote_schema.sql.
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS category    varchar(40);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS card_design smallint;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS banner_url  varchar(500);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS banner_path varchar(300);

DO $$ BEGIN
  ALTER TABLE vendors ADD CONSTRAINT vendors_category_ck CHECK (
    category IN ('cafe', 'cafe_restaurant', 'restaurant', 'bakery', 'desserts', 'juice_bar')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE vendors ADD CONSTRAINT vendors_card_design_ck CHECK (card_design BETWEEN 1 AND 10);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
