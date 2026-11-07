-- Plan change requests (decided 2026-11-07): until Paymob, a merchant on a paid plan never changes
-- plan or branch count by themselves. They send a request (Settings → Billing), the dvote team takes
-- the money and approves or rejects it (admin Plan requests page).
-- * paid_branches: how many open branches the paid plan covers (NULL = no limit: trials and shops
--   dvote runs without a paid period). Adding or reopening a branch past it is refused.
-- * Upgrades (higher plan / more branches) apply on approval; the charge is the difference for the
--   days left in the paid period. Downgrades (lower plan / fewer branches) and monthly ↔ annual are
--   forced at the end of the paid period: next_paid_branches and next_keep (the branch and reward
--   ids the merchant chose to keep) ride along next_plan.
-- * Unpaid trials are no longer deleted by themselves: delete_at is kept for old rows only, and the
--   dvote team deletes a shop by hand.
-- * billing_reminders: one row per email sent (5 days before / on the end date), so none repeats.
ALTER TABLE vendors
  ADD COLUMN paid_branches      integer,
  ADD COLUMN next_paid_branches integer,
  ADD COLUMN next_keep          jsonb,
  ADD CONSTRAINT vendors_paid_branches_ck CHECK (paid_branches IS NULL OR paid_branches BETWEEN 1 AND 500),
  ADD CONSTRAINT vendors_next_paid_branches_ck CHECK (next_paid_branches IS NULL OR next_paid_branches BETWEEN 1 AND 500);

-- a trial only needs its end date now (no deletion date)
ALTER TABLE vendors DROP CONSTRAINT vendors_trial_dates_ck,
  ADD CONSTRAINT vendors_trial_dates_ck CHECK (plan_status <> 'trial' OR trial_ends_at IS NOT NULL);

CREATE TABLE plan_requests (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id       uuid          NOT NULL REFERENCES vendors (id),
    requested_by    uuid          NOT NULL,
    from_plan       varchar(10),
    from_cycle      varchar(7),
    from_branches   integer,
    plan            varchar(10)   NOT NULL,
    billing_cycle   varchar(7)    NOT NULL,
    branches        integer       NOT NULL,
    keep_branch_ids uuid[]        NOT NULL DEFAULT '{}',
    keep_reward_ids uuid[]        NOT NULL DEFAULT '{}',
    -- what to collect now (prorated upgrade) and the price of the new plan per period, in EGP
    amount_due      numeric(12,2) NOT NULL DEFAULT 0,
    period_price    numeric(12,2) NOT NULL,
    kind            varchar(10)   NOT NULL,
    status          varchar(10)   NOT NULL DEFAULT 'pending',
    reviewed_by     uuid          REFERENCES platform_admins (id),
    reviewed_at     timestamptz,
    review_note     varchar(500),
    created_at      timestamptz   NOT NULL DEFAULT now(),
    updated_at      timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT plan_requests_staff_fk FOREIGN KEY (requested_by, vendor_id) REFERENCES staff_users (id, vendor_id),
    CONSTRAINT plan_requests_plan_ck CHECK (plan IN ('regular', 'loyal', 'chain')),
    CONSTRAINT plan_requests_cycle_ck CHECK (billing_cycle IN ('monthly', 'annual')),
    CONSTRAINT plan_requests_branches_ck CHECK (branches BETWEEN 1 AND 500),
    CONSTRAINT plan_requests_kind_ck CHECK (kind IN ('upgrade', 'downgrade', 'change')),
    CONSTRAINT plan_requests_status_ck CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    CONSTRAINT plan_requests_reviewed_ck CHECK ((status IN ('approved', 'rejected')) = (reviewed_at IS NOT NULL))
);
-- one open request per shop
CREATE UNIQUE INDEX plan_requests_one_pending_uq ON plan_requests (vendor_id) WHERE status = 'pending';
CREATE INDEX plan_requests_status_idx ON plan_requests (status, created_at DESC);
CREATE TRIGGER plan_requests_updated_at BEFORE UPDATE ON plan_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE billing_reminders (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id  uuid        NOT NULL REFERENCES vendors (id),
    kind       varchar(20) NOT NULL,
    ends_at    timestamptz NOT NULL,
    email      varchar(255) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT billing_reminders_kind_ck CHECK (kind IN ('trial_soon', 'trial_ended', 'paid_soon', 'paid_ended')),
    CONSTRAINT billing_reminders_once_uq UNIQUE (vendor_id, kind, ends_at)
);

-- paid shops start covering the branches they have open today
UPDATE vendors v SET paid_branches = GREATEST(1, (SELECT count(*) FROM branches b WHERE b.vendor_id = v.id AND b.status = 'active'))
WHERE v.plan_status = 'active' AND v.paid_until IS NOT NULL;

-- RLS on, no policies; re-run database/supabase_lockdown.sql on Supabase after this migration
ALTER TABLE plan_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_reminders ENABLE ROW LEVEL SECURITY;
