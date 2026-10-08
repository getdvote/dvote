-- Arabic texts for rewards (the customer app shows them when it is in Arabic).
-- Optional: a reward without Arabic text is shown with its English name/description.
-- Idempotent so it is safe on databases built from the updated database/dvote_schema.sql.
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS name_ar        varchar(120);
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS description_ar varchar(500);
