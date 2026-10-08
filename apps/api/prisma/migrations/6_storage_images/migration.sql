-- Uploaded images live in Supabase Storage; the database keeps where each file is.
--   bucket "avatars" (private): <user id>/<random>.webp          -> users.avatar_path
--   bucket "vendors" (public):  <vendor id>/logo/<random>.webp    -> vendors.logo_path (+ logo_url = its public URL)
--                               <vendor id>/menu/<random>.webp    -> vendor_images (kind menu)
--                               <vendor id>/branches/<branch id>/<random>.webp -> vendor_images (kind branch_photo)
-- Deleting an image removes the file and its row (media, not business history).
-- Idempotent so it is safe on databases built from the updated database/dvote_schema.sql.

ALTER TABLE users   ADD COLUMN IF NOT EXISTS avatar_path varchar(300);  -- uploaded photo; NULL = none (avatar_url may hold the sign-in provider's photo)
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS logo_path   varchar(300);  -- uploaded logo; NULL = none or an external logo_url

DO $$
BEGIN
    CREATE TYPE vendor_image_kind AS ENUM ('menu', 'branch_photo');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS vendor_images (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id     uuid              NOT NULL REFERENCES vendors (id),
    branch_id     uuid,                                 -- branch photos only
    kind          vendor_image_kind NOT NULL,
    storage_path  varchar(300)      NOT NULL UNIQUE,    -- path inside the "vendors" bucket
    sort_order    integer           NOT NULL DEFAULT 0,
    created_at    timestamptz       NOT NULL DEFAULT now(),
    updated_at    timestamptz       NOT NULL DEFAULT now(),
    -- a branch photo's branch must belong to the same vendor
    CONSTRAINT vendor_images_branch_fk FOREIGN KEY (branch_id, vendor_id) REFERENCES branches (id, vendor_id),
    CONSTRAINT vendor_images_kind_ck CHECK (
        (kind = 'menu' AND branch_id IS NULL) OR
        (kind = 'branch_photo' AND branch_id IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS vendor_images_vendor_idx ON vendor_images (vendor_id, kind, branch_id, sort_order);

DROP TRIGGER IF EXISTS vendor_images_set_updated_at ON vendor_images;
CREATE TRIGGER vendor_images_set_updated_at BEFORE UPDATE ON vendor_images
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
