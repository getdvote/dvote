-- Custom customer segments (merchant dashboard → Customers → Segmentation).
-- A segment has rules (members follow them automatically) and/or customers added by hand.
-- Each customer shows at most one custom segment (next to their built-in, computed segment):
-- a hand-added segment wins, then the first segment (sort_order) whose rules match.
-- rules: [{"field": "...", "op": "gte|lte|eq|is|is_not", "value": ...}], checked by the API.
-- Idempotent so it is safe on databases built from the updated database/dvote_schema.sql.

CREATE TABLE IF NOT EXISTS customer_segments (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           uuid         NOT NULL REFERENCES vendors (id),
    name                varchar(60)  NOT NULL CHECK (btrim(name) <> ''),
    description         varchar(300),
    match               varchar(3)   NOT NULL DEFAULT 'all' CHECK (match IN ('all', 'any')),
    rules               jsonb        NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(rules) = 'array'),
    sort_order          int          NOT NULL DEFAULT 0,
    status              varchar(10)  NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by_staff_id uuid         REFERENCES staff_users (id),
    created_at          timestamptz  NOT NULL DEFAULT now(),
    updated_at          timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (id, vendor_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_segments_name_uq
    ON customer_segments (vendor_id, lower(name)) WHERE status = 'active';

-- Hand-made membership: included = added by hand, false = removed by hand (beats the rules).
CREATE TABLE IF NOT EXISTS customer_segment_members (
    segment_id      uuid        NOT NULL,
    card_id         uuid        NOT NULL,
    vendor_id       uuid        NOT NULL,
    included        boolean     NOT NULL,
    set_by_staff_id uuid        REFERENCES staff_users (id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (segment_id, card_id),
    FOREIGN KEY (segment_id, vendor_id) REFERENCES customer_segments (id, vendor_id),
    FOREIGN KEY (card_id, vendor_id) REFERENCES cards (id, vendor_id)
);
CREATE INDEX IF NOT EXISTS customer_segment_members_card_idx ON customer_segment_members (vendor_id, card_id);

DO $$ BEGIN
  CREATE TRIGGER customer_segments_set_updated_at BEFORE UPDATE ON customer_segments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER customer_segment_members_set_updated_at BEFORE UPDATE ON customer_segment_members
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
