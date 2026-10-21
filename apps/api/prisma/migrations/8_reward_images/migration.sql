-- Reward photos: uploaded to Storage bucket "vendors" at <vendorId>/rewards/<uuid>.webp.
-- image_url (already there) is the public link; image_path is set when the file is in Storage.
-- Idempotent so it is safe on databases built from the updated database/dvote_schema.sql.
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS image_path varchar(300);
