-- =====================================================================
--  v2.0 business model: spend-based points, vendor rewards, one-time QR codes.
--  Replaces NFC cards, "buy N get 1" programs, wallets and scan sessions.
--  Keeps vendors, branches, staff_users, users, user_identities, platform_admins.
--
--  NOT idempotent (it drops the v1 loyalty tables). A database built from the
--  v2.0 database/dvote_schema.sql already has this shape: mark it applied with
--    npx prisma migrate resolve --applied 3_points_rewards_qr
-- =====================================================================

-- Refuse to run twice (e.g. on a database built from the v2.0 schema file).
DO $$
BEGIN
    IF to_regclass('public.cards') IS NOT NULL THEN
        RAISE EXCEPTION 'v2.0 tables already exist; run: prisma migrate resolve --applied 3_points_rewards_qr';
    END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- 1. Drop the v1 loyalty tables (order respects foreign keys)
-- ---------------------------------------------------------------------
DROP TABLE redemptions;
DROP TABLE point_events;            -- its append-only trigger goes with it
DROP TABLE scan_sessions;
DROP TABLE wallets;
DROP TABLE fraud_flags;
DROP TABLE nfc_tags;
DROP TABLE programs;
DROP FUNCTION point_events_block_changes();

DROP TYPE tag_status;
DROP TYPE scan_mode;
DROP TYPE session_status;
DROP TYPE fraud_flag_type;

-- ---------------------------------------------------------------------
-- 2. Vendor currency (receipt totals are in the vendor's currency)
-- ---------------------------------------------------------------------
ALTER TABLE vendors ADD COLUMN currency char(3) NOT NULL DEFAULT 'EGP';

-- ---------------------------------------------------------------------
-- 3. New enum types
-- ---------------------------------------------------------------------
CREATE TYPE reward_status   AS ENUM ('active', 'archived');
CREATE TYPE qr_purpose      AS ENUM ('collect', 'redeem');
CREATE TYPE qr_status       AS ENUM ('active', 'used', 'expired', 'cancelled');
CREATE TYPE fraud_flag_type AS ENUM ('too_many_collects', 'large_purchase', 'branch_spike', 'staff_spike');

-- ---------------------------------------------------------------------
-- 4. Vendor side: earning rules and rewards
-- ---------------------------------------------------------------------
CREATE TABLE point_rules (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id               uuid          NOT NULL REFERENCES vendors (id),
    version                 int           NOT NULL CHECK (version >= 1),
    spend_amount            numeric(12,2) NOT NULL CHECK (spend_amount > 0),
    points_per_spend        int           NOT NULL DEFAULT 1 CHECK (points_per_spend > 0),
    min_purchase            numeric(12,2) NOT NULL DEFAULT 0 CHECK (min_purchase >= 0),
    max_points_per_purchase int           CHECK (max_points_per_purchase > 0),
    is_active               boolean       NOT NULL DEFAULT true,
    created_by_staff_id     uuid          REFERENCES staff_users (id),
    created_at              timestamptz   NOT NULL DEFAULT now(),
    updated_at              timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (vendor_id, version),
    UNIQUE (id, vendor_id)
);
CREATE UNIQUE INDEX point_rules_one_active_uq ON point_rules (vendor_id) WHERE is_active;

CREATE TABLE rewards (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id    uuid          NOT NULL REFERENCES vendors (id),
    name         varchar(120)  NOT NULL,
    description  varchar(500),
    image_url    varchar(500),
    points_cost  int           NOT NULL CHECK (points_cost > 0),
    status       reward_status NOT NULL DEFAULT 'active',
    sort_order   int           NOT NULL DEFAULT 0,
    created_at   timestamptz   NOT NULL DEFAULT now(),
    updated_at   timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (id, vendor_id)
);
CREATE INDEX rewards_vendor_idx ON rewards (vendor_id, status, sort_order);

-- ---------------------------------------------------------------------
-- 5. Customer side: one card (balance) per customer per vendor
-- ---------------------------------------------------------------------
CREATE TABLE cards (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid        NOT NULL REFERENCES users (id),
    vendor_id         uuid        NOT NULL REFERENCES vendors (id),
    balance           int         NOT NULL DEFAULT 0 CHECK (balance >= 0),
    lifetime_points   int         NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
    last_activity_at  timestamptz NOT NULL DEFAULT now(),
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, vendor_id),
    UNIQUE (id, vendor_id)
);
CREATE INDEX cards_vendor_idx ON cards (vendor_id);

-- ---------------------------------------------------------------------
-- 6. Activity: one-time QR codes, the ledger, redemptions
-- ---------------------------------------------------------------------
CREATE TABLE qr_codes (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid        NOT NULL REFERENCES users (id),
    purpose           qr_purpose  NOT NULL,
    vendor_id         uuid        REFERENCES vendors (id),       -- NULL = master QR (collect at any vendor)
    reward_id         uuid,                                       -- redeem only
    token_hash        char(64)    NOT NULL UNIQUE,                -- sha256 hex of the QR secret; never the secret
    status            qr_status   NOT NULL DEFAULT 'active',
    expires_at        timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
    used_at           timestamptz,
    used_by_staff_id  uuid        REFERENCES staff_users (id),
    used_branch_id    uuid        REFERENCES branches (id),
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (reward_id, vendor_id) REFERENCES rewards (id, vendor_id),
    CONSTRAINT qr_purpose_ck CHECK (
        (purpose = 'collect' AND reward_id IS NULL) OR
        (purpose = 'redeem'  AND reward_id IS NOT NULL AND vendor_id IS NOT NULL)
    ),
    CONSTRAINT qr_used_ck CHECK (
        status <> 'used' OR
        (used_at IS NOT NULL AND used_by_staff_id IS NOT NULL AND used_branch_id IS NOT NULL)
    )
);
CREATE INDEX qr_codes_user_idx ON qr_codes (user_id, created_at DESC);

CREATE TABLE point_events (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id          uuid             NOT NULL,
    vendor_id        uuid             NOT NULL REFERENCES vendors (id),
    branch_id        uuid,                                         -- NULL only for admin adjustments
    type             point_event_type NOT NULL,
    delta            int              NOT NULL,
    purchase_amount  numeric(12,2),                                -- earn: receipt total
    receipt_ref      varchar(64),                                  -- earn: optional receipt number
    rule_id          uuid,                                         -- earn: rule version used
    reward_id        uuid,                                         -- redeem: reward given
    qr_code_id       uuid             REFERENCES qr_codes (id),
    staff_id         uuid             REFERENCES staff_users (id), -- who scanned
    created_by       uuid             REFERENCES platform_admins (id),
    reason           varchar(500),
    idempotency_key  varchar(100)     NOT NULL UNIQUE,
    created_at       timestamptz      NOT NULL DEFAULT now(),
    updated_at       timestamptz      NOT NULL DEFAULT now(),
    -- every reference must belong to the same vendor: points never cross vendors
    FOREIGN KEY (card_id, vendor_id)   REFERENCES cards (id, vendor_id),
    FOREIGN KEY (branch_id, vendor_id) REFERENCES branches (id, vendor_id),
    FOREIGN KEY (rule_id, vendor_id)   REFERENCES point_rules (id, vendor_id),
    FOREIGN KEY (reward_id, vendor_id) REFERENCES rewards (id, vendor_id),
    CONSTRAINT point_events_rules_ck CHECK (
        (type = 'earn' AND delta > 0 AND purchase_amount > 0 AND rule_id IS NOT NULL
            AND reward_id IS NULL AND qr_code_id IS NOT NULL AND staff_id IS NOT NULL
            AND branch_id IS NOT NULL) OR
        (type = 'redeem' AND delta < 0 AND reward_id IS NOT NULL AND qr_code_id IS NOT NULL
            AND staff_id IS NOT NULL AND branch_id IS NOT NULL) OR
        (type = 'adjust' AND delta <> 0 AND created_by IS NOT NULL AND reason IS NOT NULL)
    )
);
-- one ledger row per QR code at most
CREATE UNIQUE INDEX point_events_qr_uq ON point_events (qr_code_id) WHERE qr_code_id IS NOT NULL;
-- a receipt number can earn points only once per branch
CREATE UNIQUE INDEX point_events_receipt_uq ON point_events (branch_id, receipt_ref)
    WHERE type = 'earn' AND receipt_ref IS NOT NULL;
CREATE INDEX point_events_card_time_idx   ON point_events (card_id, created_at);
CREATE INDEX point_events_branch_time_idx ON point_events (branch_id, created_at);
CREATE INDEX point_events_vendor_time_idx ON point_events (vendor_id, created_at);
CREATE INDEX point_events_staff_time_idx  ON point_events (staff_id, created_at);

CREATE TABLE redemptions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id         uuid         NOT NULL,
    vendor_id       uuid         NOT NULL REFERENCES vendors (id),
    reward_id       uuid         NOT NULL,
    branch_id       uuid         NOT NULL,
    staff_id        uuid         NOT NULL REFERENCES staff_users (id),
    point_event_id  uuid         NOT NULL UNIQUE REFERENCES point_events (id),
    reward_name     varchar(120) NOT NULL,                         -- snapshot at redemption time
    points_cost     int          NOT NULL CHECK (points_cost > 0), -- snapshot at redemption time
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    FOREIGN KEY (card_id, vendor_id)   REFERENCES cards (id, vendor_id),
    FOREIGN KEY (reward_id, vendor_id) REFERENCES rewards (id, vendor_id),
    FOREIGN KEY (branch_id, vendor_id) REFERENCES branches (id, vendor_id)
);
CREATE INDEX redemptions_card_idx ON redemptions (card_id);
CREATE INDEX redemptions_branch_time_idx ON redemptions (branch_id, created_at);

-- ---------------------------------------------------------------------
-- 7. Fraud flags
-- ---------------------------------------------------------------------
CREATE TABLE fraud_flags (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type         fraud_flag_type   NOT NULL,
    vendor_id    uuid              REFERENCES vendors (id),
    branch_id    uuid              REFERENCES branches (id),
    user_id      uuid              REFERENCES users (id),
    staff_id     uuid              REFERENCES staff_users (id),
    details      jsonb             NOT NULL DEFAULT '{}'::jsonb,
    status       fraud_flag_status NOT NULL DEFAULT 'open',
    reviewed_by  uuid              REFERENCES platform_admins (id),
    created_at   timestamptz       NOT NULL DEFAULT now(),
    updated_at   timestamptz       NOT NULL DEFAULT now(),
    CONSTRAINT fraud_flags_target_ck CHECK (num_nonnulls(vendor_id, branch_id, user_id, staff_id) >= 1),
    CONSTRAINT fraud_flags_review_ck CHECK (status = 'open' OR reviewed_by IS NOT NULL)
);
CREATE INDEX fraud_flags_status_time_idx ON fraud_flags (status, created_at);
CREATE INDEX fraud_flags_vendor_idx ON fraud_flags (vendor_id);

-- ---------------------------------------------------------------------
-- 8. Triggers
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['point_rules','rewards','cards','qr_codes','point_events','redemptions','fraud_flags']
    LOOP
        EXECUTE format(
            'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
    END LOOP;
END;
$$;

-- the ledger is append-only: no UPDATE or DELETE on point_events
CREATE FUNCTION point_events_block_changes() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'point_events is append-only; write an adjust row instead';
END;
$$;

CREATE TRIGGER point_events_no_update BEFORE UPDATE OR DELETE ON point_events
    FOR EACH ROW EXECUTE FUNCTION point_events_block_changes();
