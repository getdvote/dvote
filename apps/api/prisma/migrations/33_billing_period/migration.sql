-- Billing page (decided 2026-10-23): a paid shop is paid until a date (set by the dvote team when
-- the merchant pays: +1 month or +1 year); 7 days of grace after it, then the dashboard locks
-- (customer cards keep working). Upgrades apply at once; downgrades and billing-cycle switches
-- wait for the end of the paid period (next_plan / next_billing_cycle). Founding Merchants get
-- 30% off their plan until founding_until (6 months after the spot was given).
ALTER TABLE vendors
  ADD COLUMN paid_until         timestamptz,
  ADD COLUMN next_plan          varchar(10),
  ADD COLUMN next_billing_cycle varchar(7),
  ADD COLUMN founding_until     timestamptz,
  ADD CONSTRAINT vendors_next_plan_ck CHECK (next_plan IS NULL OR next_plan IN ('regular', 'loyal', 'chain')),
  ADD CONSTRAINT vendors_next_billing_cycle_ck CHECK (
    (next_plan IS NULL AND next_billing_cycle IS NULL)
    OR (next_plan IS NOT NULL AND next_billing_cycle IN ('monthly', 'annual'))
  );

-- shops that already hold a Founding spot keep the discount for 6 months from now
UPDATE vendors SET founding_until = now() + interval '6 months' WHERE founding AND founding_until IS NULL;

CREATE INDEX vendors_billing_due_idx ON vendors (paid_until) WHERE next_plan IS NOT NULL;
