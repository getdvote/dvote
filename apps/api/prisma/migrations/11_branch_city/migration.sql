-- Branch city (Egypt), picked from a fixed list; address is now the street line only.
-- The key list lives in the API (src/branches/cities.ts) so cities can be added without a migration.
-- Idempotent so it is safe on databases built from the updated database/dvote_schema.sql.
ALTER TABLE branches ADD COLUMN IF NOT EXISTS city varchar(40);
