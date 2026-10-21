-- The customer's last known location (sent by the app when it opens, with the customer's
-- permission), used only to list the shops nearest to them. Overwritten each time; no history.
-- Idempotent so it is safe on databases built from the updated database/dvote_schema.sql.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lat         decimal(9,6) CHECK (last_lat BETWEEN -90 AND 90);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lng         decimal(9,6) CHECK (last_lng BETWEEN -180 AND 180);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_location_at timestamptz;
