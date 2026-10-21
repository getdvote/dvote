-- Self-service sign-up with a 7-day free trial (decided 2026-10-21).
-- plan_status: 'trial' (self sign-up, until an admin activates a plan) or 'active' (paying /
-- created by an admin). Existing shops become 'active'. A trial shop is locked once
-- trial_ends_at has passed and deleted for good at delete_at (30 days after sign-up) unless
-- activated first. Only shops with self_signup = true are ever deleted automatically.
ALTER TABLE vendors
  ADD COLUMN plan_status   varchar(10) NOT NULL DEFAULT 'active',
  ADD COLUMN plan          varchar(10),
  ADD COLUMN trial_ends_at timestamptz,
  ADD COLUMN delete_at     timestamptz,
  ADD COLUMN self_signup   boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT vendors_plan_status_ck CHECK (plan_status IN ('trial', 'active')),
  ADD CONSTRAINT vendors_plan_ck CHECK (plan IS NULL OR plan IN ('starter', 'growth', 'chain')),
  ADD CONSTRAINT vendors_trial_dates_ck CHECK (
    plan_status <> 'trial' OR (trial_ends_at IS NOT NULL AND delete_at IS NOT NULL AND delete_at >= trial_ends_at)
  );

CREATE INDEX vendors_trial_idx ON vendors (trial_ends_at, delete_at) WHERE plan_status = 'trial';
