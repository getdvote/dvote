-- New plans (decided 2026-10-23, docs/billing-gating-spec.md): Regular / Loyal / Chain priced per
-- branch, monthly or annual billing, a 14-day trial and a Founding Merchants offer (the first 10
-- merchants get 30% off for 6 months). Old plan names map starter -> regular, growth -> loyal.
ALTER TABLE vendors DROP CONSTRAINT vendors_plan_ck;
UPDATE vendors SET plan = CASE plan WHEN 'starter' THEN 'regular' WHEN 'growth' THEN 'loyal' ELSE plan END
  WHERE plan IN ('starter', 'growth');
ALTER TABLE vendors
  ADD CONSTRAINT vendors_plan_ck CHECK (plan IS NULL OR plan IN ('regular', 'loyal', 'chain')),
  ADD COLUMN billing_cycle varchar(7),
  ADD COLUMN founding      boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT vendors_billing_cycle_ck CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly', 'annual'));

-- Platform-wide settings set by the dvote team (one row per key). 'founding' = {total, open}:
-- how many Founding spots exist and whether the offer is shown; spots left = total - founding shops.
CREATE TABLE platform_settings (
  key        varchar(40) PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_by uuid REFERENCES platform_admins(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO platform_settings (key, value) VALUES ('founding', '{"total": 10, "open": true}');
CREATE TRIGGER platform_settings_set_updated_at BEFORE UPDATE ON platform_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON platform_settings FROM anon; END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON platform_settings FROM authenticated; END IF;
END $$;
