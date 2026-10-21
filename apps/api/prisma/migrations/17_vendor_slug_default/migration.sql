-- The slug is filled by the vendors_fill_slug trigger (16_wallet_join) when a merchant is created
-- without one. An empty default lets the code (Prisma) leave it out; the BEFORE INSERT trigger
-- replaces '' with a free slug from the name before the CHECK and unique index apply.
ALTER TABLE vendors ALTER COLUMN slug SET DEFAULT '';
