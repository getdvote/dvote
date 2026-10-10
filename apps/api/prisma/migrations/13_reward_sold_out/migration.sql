-- A reward can run out at one branch for a while (e.g. no cheesecake left at Zamalek today).
-- One row per (reward, branch): sold out while sold_out_until IS NULL (until someone turns it
-- back on) or sold_out_until > now(). Turning it back on sets sold_out_until = now(), so the
-- row stays (no deletes) and the next "sold out" overwrites it. Nothing runs on a schedule:
-- a timed sold-out simply stops counting when its time passes.
-- Idempotent so it is safe on databases built from the updated database/dvote_schema.sql.

CREATE TABLE IF NOT EXISTS reward_sold_outs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id       uuid        NOT NULL REFERENCES vendors (id),
    reward_id       uuid        NOT NULL,
    branch_id       uuid        NOT NULL,
    sold_out_until  timestamptz,                         -- NULL = until turned back on
    set_by_staff_id uuid        REFERENCES staff_users (id),  -- who last changed it (NULL = dvote admin)
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    -- reward and branch must both belong to the row's vendor
    CONSTRAINT reward_sold_outs_reward_fk FOREIGN KEY (reward_id, vendor_id) REFERENCES rewards (id, vendor_id),
    CONSTRAINT reward_sold_outs_branch_fk FOREIGN KEY (branch_id, vendor_id) REFERENCES branches (id, vendor_id),
    CONSTRAINT reward_sold_outs_uq UNIQUE (reward_id, branch_id)
);
CREATE INDEX IF NOT EXISTS reward_sold_outs_vendor_idx ON reward_sold_outs (vendor_id, branch_id);

DROP TRIGGER IF EXISTS reward_sold_outs_set_updated_at ON reward_sold_outs;
CREATE TRIGGER reward_sold_outs_set_updated_at BEFORE UPDATE ON reward_sold_outs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
