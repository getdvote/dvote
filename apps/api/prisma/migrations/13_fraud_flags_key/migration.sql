-- One flag per finding: the fraud check runs every 15 minutes over today and yesterday, so the
-- same finding (e.g. "customer X, shop Y, 2026-10-11, too many collects") must not be flagged
-- twice. `key` is built by the check (type + target + day, or the ledger row for a large
-- purchase); inserts use ON CONFLICT (key) DO NOTHING. NULL for flags made by hand.
-- Idempotent so it is safe on databases built from the updated database/dvote_schema.sql.
ALTER TABLE fraud_flags ADD COLUMN IF NOT EXISTS key varchar(200);
CREATE UNIQUE INDEX IF NOT EXISTS fraud_flags_key_uq ON fraud_flags (key);
