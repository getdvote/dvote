-- =====================================================================
--  dvote — Loyalty Platform schema (v2.0: spend-based points, rewards, one-time QR codes)
--  Target: PostgreSQL 18 (also runs on 13+)
--  Run in pgAdmin: open the Query Tool ON THE dvote DATABASE, paste, F5.
--  Wrapped in one transaction: if anything fails, nothing is created.
--
--  A database built from this file already matches every Prisma migration; mark them
--  applied (from apps/api):  npx prisma migrate resolve --applied <name>
--  for 0_init, 1_users_auth_user_id, 2_staff_users_auth_user_id, 3_points_rewards_qr,
--  4_platform_admins_auth_user_id.
-- =====================================================================
BEGIN;

-- ---------------------------------------------------------------------
-- 1. ENUM TYPES
-- ---------------------------------------------------------------------
CREATE TYPE vendor_status       AS ENUM ('active', 'suspended');
CREATE TYPE branch_status       AS ENUM ('active', 'closed');
CREATE TYPE staff_role          AS ENUM ('vendor_admin', 'branch_manager', 'staff');
CREATE TYPE account_status      AS ENUM ('active', 'disabled');          -- staff + platform admins
CREATE TYPE user_status         AS ENUM ('active', 'blocked');           -- customers
CREATE TYPE auth_provider       AS ENUM ('google', 'facebook', 'apple');
CREATE TYPE reward_status       AS ENUM ('active', 'archived');
CREATE TYPE qr_purpose          AS ENUM ('collect', 'redeem');
CREATE TYPE qr_status           AS ENUM ('active', 'used', 'expired', 'cancelled');
CREATE TYPE point_event_type    AS ENUM ('earn', 'redeem', 'adjust');
CREATE TYPE fraud_flag_type     AS ENUM ('too_many_collects', 'large_purchase', 'branch_spike', 'staff_spike');
CREATE TYPE fraud_flag_status   AS ENUM ('open', 'dismissed', 'confirmed');

-- ---------------------------------------------------------------------
-- 2. HELPER: keep updated_at current on every UPDATE
-- ---------------------------------------------------------------------
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. PLATFORM SIDE
-- ---------------------------------------------------------------------
CREATE TABLE platform_admins (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name             varchar(120)   NOT NULL,
    email            varchar(255)   NOT NULL,
    password_hash    varchar(255),                       -- legacy; passwords live in Supabase Auth
    totp_secret_ref  varchar(255),                       -- legacy; 2FA (TOTP) is handled by Supabase Auth MFA
    auth_user_id     uuid,                               -- Supabase Auth user id
    status           account_status NOT NULL DEFAULT 'active',
    created_at       timestamptz    NOT NULL DEFAULT now(),
    updated_at       timestamptz    NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX platform_admins_email_uq ON platform_admins (lower(email));
CREATE UNIQUE INDEX platform_admins_auth_user_id_key ON platform_admins (auth_user_id);

-- ---------------------------------------------------------------------
-- 4. VENDOR SIDE
-- ---------------------------------------------------------------------
CREATE TABLE vendors (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name           varchar(120)  NOT NULL,
    logo_url       varchar(500),
    contact_email  varchar(255),
    currency       char(3)       NOT NULL DEFAULT 'EGP',    -- receipt totals are in this currency
    status         vendor_status NOT NULL DEFAULT 'active',
    created_at     timestamptz   NOT NULL DEFAULT now(),
    updated_at     timestamptz   NOT NULL DEFAULT now()
);

CREATE TABLE branches (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id   uuid          NOT NULL REFERENCES vendors (id),
    name        varchar(120)  NOT NULL,
    address     varchar(500),
    lat         decimal(9,6)  CHECK (lat BETWEEN -90 AND 90),
    lng         decimal(9,6)  CHECK (lng BETWEEN -180 AND 180),
    timezone    varchar(64)   NOT NULL DEFAULT 'Africa/Cairo',
    status      branch_status NOT NULL DEFAULT 'active',
    created_at  timestamptz   NOT NULL DEFAULT now(),
    updated_at  timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (id, vendor_id)          -- lets other tables prove "this branch belongs to this vendor"
);
CREATE INDEX branches_vendor_idx ON branches (vendor_id);

CREATE TABLE staff_users (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id      uuid           NOT NULL REFERENCES vendors (id),
    branch_id      uuid,                                  -- NULL = vendor-wide admin
    name           varchar(120)   NOT NULL,
    email          varchar(255)   NOT NULL,
    password_hash  varchar(255),                          -- legacy; passwords live in Supabase Auth
    auth_user_id   uuid,                                  -- Supabase Auth user id
    role           staff_role     NOT NULL,
    status         account_status NOT NULL DEFAULT 'active',
    created_at     timestamptz    NOT NULL DEFAULT now(),
    updated_at     timestamptz    NOT NULL DEFAULT now(),
    -- the branch must belong to the same vendor
    FOREIGN KEY (branch_id, vendor_id) REFERENCES branches (id, vendor_id),
    -- vendor admins are vendor-wide; managers and staff belong to one branch
    CONSTRAINT staff_role_branch_ck CHECK (
        (role = 'vendor_admin' AND branch_id IS NULL) OR
        (role <> 'vendor_admin' AND branch_id IS NOT NULL)
    )
);
CREATE UNIQUE INDEX staff_users_email_uq ON staff_users (lower(email));
CREATE UNIQUE INDEX staff_users_auth_user_id_key ON staff_users (auth_user_id);
CREATE INDEX staff_users_vendor_idx ON staff_users (vendor_id);

-- Earning rule ("settings"), versioned: points = floor(total / spend_amount) * points_per_spend
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

-- The vendor's reward catalogue, e.g. "Free coffee" for 300 points
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
-- 5. CUSTOMER SIDE
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        varchar(120),
    email       varchar(255),                 -- a provider may not share it; not unique
    avatar_url  varchar(500),
    phone       varchar(20),                  -- optional, not used for login
    auth_user_id uuid,                        -- Supabase Auth user id
    status      user_status NOT NULL DEFAULT 'active',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_auth_user_id_key ON users (auth_user_id);

-- currently unused: Supabase Auth tracks provider identities and links them
CREATE TABLE user_identities (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid          NOT NULL REFERENCES users (id),
    provider          auth_provider NOT NULL,
    provider_user_id  varchar(255)  NOT NULL,  -- the provider's stable "sub" id
    email             varchar(255),
    created_at        timestamptz   NOT NULL DEFAULT now(),
    updated_at        timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_user_id)
);
CREATE INDEX user_identities_user_idx ON user_identities (user_id);

-- One card (points balance) per customer per vendor; created on the first purchase
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
-- 6. ACTIVITY
-- ---------------------------------------------------------------------
-- One row per QR the app shows; single use, short-lived
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

-- The ledger: every earn (+), redeem (-) and admin adjust (+/-). Append-only.
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
-- 7. FRAUD FLAGS
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
-- 8. TRIGGERS
-- ---------------------------------------------------------------------
-- updated_at on every table
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'platform_admins','vendors','branches','staff_users','point_rules','rewards',
        'users','user_identities','cards','qr_codes','point_events','redemptions','fraud_flags']
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

COMMIT;

-- Check: should list 13 tables
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name <> '_prisma_migrations' ORDER BY 1;
