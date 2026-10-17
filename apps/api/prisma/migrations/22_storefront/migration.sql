-- Storefront (the merchant's public page, dvote.app/<slug>) and its look.
-- vendors.storefront: {"sections": [{"type": "loyalty" | "rewards" | "menu" | "branches" | "wifi", ...}]}
--   in page order; a section not in the list is not shown. NULL = the default page. Checked by the API.
-- branches.storefront: the same, for one branch (opened with ?b=<branch>); NULL = use the shop's.
-- page_style: spotlight (default) | compact | branded. brand_primary / brand_secondary: #rrggbb.
-- brand_font: one of the API's curated font keys (NULL = the default font).
-- Idempotent so it is safe on databases built from the updated database/dvote_schema.sql.
ALTER TABLE vendors  ADD COLUMN IF NOT EXISTS storefront      jsonb;
ALTER TABLE vendors  ADD COLUMN IF NOT EXISTS page_style      varchar(20);
ALTER TABLE vendors  ADD COLUMN IF NOT EXISTS brand_primary   varchar(7);
ALTER TABLE vendors  ADD COLUMN IF NOT EXISTS brand_secondary varchar(7);
ALTER TABLE vendors  ADD COLUMN IF NOT EXISTS brand_font      varchar(40);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS storefront      jsonb;

DO $$ BEGIN
  ALTER TABLE vendors ADD CONSTRAINT vendors_page_style_ck CHECK (page_style IN ('spotlight', 'compact', 'branded'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE vendors ADD CONSTRAINT vendors_brand_colors_ck CHECK (
    (brand_primary IS NULL OR brand_primary ~ '^#[0-9a-f]{6}$') AND
    (brand_secondary IS NULL OR brand_secondary ~ '^#[0-9a-f]{6}$'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE vendors ADD CONSTRAINT vendors_storefront_ck CHECK (storefront IS NULL OR jsonb_typeof(storefront) = 'object');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE branches ADD CONSTRAINT branches_storefront_ck CHECK (storefront IS NULL OR jsonb_typeof(storefront) = 'object');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
