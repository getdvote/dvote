-- =====================================================================
--  dvote — Coffee Loyalty Platform schema (v1.2)
--  Target: PostgreSQL 18 (also runs on 13+)
--  Run in pgAdmin: open the Query Tool ON THE dvote DATABASE, paste, F5.
--  The whole script is one transaction: if anything fails, nothing is created.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ENUM TYPES
-- ---------------------------------------------------------------------
CREATE TYPE vendor_status       AS ENUM ('active', 'suspended');
CREATE TYPE branch_status       AS ENUM ('active', 'closed');
CREATE TYPE tag_status          AS ENUM ('active', 'lost', 'revoked');
CREATE TYPE staff_role          AS ENUM ('vendor_admin', 'branch_manager', 'staff');
CREATE TYPE account_status      AS ENUM ('active', 'disabled');          -- staff + platform admins
CREATE TYPE user_status         AS ENUM ('active', 'blocked');           -- customers
CREATE TYPE auth_provider       AS ENUM ('google', 'facebook', 'apple');
CREATE TYPE scan_mode           AS ENUM ('earn', 'redeem');
CREATE TYPE session_status      AS ENUM ('open', 'consumed', 'expired', 'rejected');
CREATE TYPE point_event_type    AS ENUM ('earn', 'redeem', 'adjust');
CREATE TYPE fraud_flag_type     AS ENUM ('too_many_earns', 'branch_spike', 'tag_counter_anomaly', 'far_location');
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
    password_hash    varchar(255)   NOT NULL,
    totp_secret_ref  varchar(255),                       -- 2FA secret lives in the secrets store
    status           account_status NOT NULL DEFAULT 'active',
    created_at       timestamptz    NOT NULL DEFAULT now(),
    updated_at       timestamptz    NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX platform_admins_email_uq ON platform_admins (lower(email));

-- ---------------------------------------------------------------------
-- 4. VENDOR SIDE
-- ---------------------------------------------------------------------
CREATE TABLE vendors (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name           varchar(120)  NOT NULL,
    logo_url       varchar(500),
    contact_email  varchar(255),
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
    password_hash  varchar(255)   NOT NULL,
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
CREATE INDEX staff_users_vendor_idx ON staff_users (vendor_id);

CREATE TABLE nfc_tags (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id     uuid         NOT NULL REFERENCES branches (id),
    tag_uid       varchar(32)  NOT NULL UNIQUE,           -- hardware UID (hex)
    key_ref       varchar(255) NOT NULL,                  -- pointer to the secret key in KMS, never the key
    last_counter  bigint       NOT NULL DEFAULT 0 CHECK (last_counter >= 0),
    status        tag_status   NOT NULL DEFAULT 'active',
    created_at    timestamptz  NOT NULL DEFAULT now(),
    updated_at    timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX nfc_tags_branch_idx ON nfc_tags (branch_id);

CREATE TABLE programs (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           uuid         NOT NULL REFERENCES vendors (id),
    version             int          NOT NULL CHECK (version >= 1),
    points_required     int          NOT NULL DEFAULT 5  CHECK (points_required > 0),
    reward_description  varchar(255) NOT NULL DEFAULT '1 free coffee',
    cooldown_minutes    int          NOT NULL DEFAULT 10 CHECK (cooldown_minutes >= 0),
    is_active           boolean      NOT NULL DEFAULT true,
    created_at          timestamptz  NOT NULL DEFAULT now(),
    updated_at          timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (vendor_id, version),
    UNIQUE (id, vendor_id)
);
-- only ONE active program per vendor
CREATE UNIQUE INDEX programs_one_active_uq ON programs (vendor_id) WHERE is_active;

-- ---------------------------------------------------------------------
-- 5. CUSTOMER SIDE
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        varchar(120),
    email       varchar(255),                 -- Apple may hide it; not unique
    avatar_url  varchar(500),
    phone       varchar(20),                  -- optional, not used for login
    auth_user_id uuid,                        -- Supabase Auth user id (migration 1_users_auth_user_id)
    status      user_status NOT NULL DEFAULT 'active',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_auth_user_id_key ON users (auth_user_id);

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

CREATE TABLE wallets (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid        NOT NULL REFERENCES users (id),
    vendor_id        uuid        NOT NULL REFERENCES vendors (id),
    program_id       uuid        NOT NULL,
    balance          int         NOT NULL DEFAULT 0 CHECK (balance >= 0),
    lifetime_points  int         NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, vendor_id),                           -- one wallet per customer per vendor
    -- the wallet's program must belong to the wallet's vendor
    FOREIGN KEY (program_id, vendor_id) REFERENCES programs (id, vendor_id)
);
CREATE INDEX wallets_vendor_idx ON wallets (vendor_id);

-- ---------------------------------------------------------------------
-- 6. ACTIVITY
-- ---------------------------------------------------------------------
CREATE TABLE scan_sessions (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid           NOT NULL REFERENCES users (id),
    vendor_id      uuid           REFERENCES vendors (id),   -- required for redeem
    tag_id         uuid           REFERENCES nfc_tags (id),  -- filled when the tap arrives
    mode           scan_mode      NOT NULL,
    status         session_status NOT NULL DEFAULT 'open',
    expires_at     timestamptz    NOT NULL DEFAULT now() + interval '90 seconds',
    reject_reason  varchar(100),
    created_at     timestamptz    NOT NULL DEFAULT now(),
    updated_at     timestamptz    NOT NULL DEFAULT now(),
    CONSTRAINT scan_redeem_vendor_ck CHECK (mode = 'earn' OR vendor_id IS NOT NULL),
    CONSTRAINT scan_reject_reason_ck CHECK (status <> 'rejected' OR reject_reason IS NOT NULL)
);
CREATE INDEX scan_sessions_user_idx ON scan_sessions (user_id, created_at DESC);

CREATE TABLE point_events (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id        uuid             NOT NULL REFERENCES wallets (id),
    branch_id        uuid             NOT NULL REFERENCES branches (id),
    session_id       uuid             REFERENCES scan_sessions (id),
    tag_id           uuid             REFERENCES nfc_tags (id),
    type             point_event_type NOT NULL,
    delta            int              NOT NULL,
    idempotency_key  varchar(100)     NOT NULL UNIQUE,
    created_by       uuid             REFERENCES platform_admins (id),
    reason           varchar(500),
    created_at       timestamptz      NOT NULL DEFAULT now(),
    updated_at       timestamptz      NOT NULL DEFAULT now(),
    CONSTRAINT point_events_rules_ck CHECK (
        (type = 'earn'   AND delta = 1  AND session_id IS NOT NULL) OR
        (type = 'redeem' AND delta < 0  AND session_id IS NOT NULL) OR
        (type = 'adjust' AND delta <> 0 AND created_by IS NOT NULL AND reason IS NOT NULL)
    )
);
-- one ledger row per scan session at most
CREATE UNIQUE INDEX point_events_session_uq ON point_events (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX point_events_wallet_time_idx   ON point_events (wallet_id, created_at);
CREATE INDEX point_events_branch_time_idx   ON point_events (branch_id, created_at);
CREATE INDEX point_events_cooldown_idx      ON point_events (wallet_id, branch_id, created_at DESC);

CREATE TABLE redemptions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id       uuid        NOT NULL REFERENCES wallets (id),
    program_id      uuid        NOT NULL REFERENCES programs (id),
    branch_id       uuid        NOT NULL REFERENCES branches (id),
    point_event_id  uuid        NOT NULL UNIQUE REFERENCES point_events (id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX redemptions_wallet_idx ON redemptions (wallet_id);
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
    tag_id       uuid              REFERENCES nfc_tags (id),
    details      jsonb             NOT NULL DEFAULT '{}'::jsonb,
    status       fraud_flag_status NOT NULL DEFAULT 'open',
    reviewed_by  uuid              REFERENCES platform_admins (id),
    created_at   timestamptz       NOT NULL DEFAULT now(),
    updated_at   timestamptz       NOT NULL DEFAULT now(),
    CONSTRAINT fraud_flags_target_ck CHECK (num_nonnulls(vendor_id, branch_id, user_id, tag_id) >= 1),
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
        'platform_admins','vendors','branches','staff_users','nfc_tags','programs',
        'users','user_identities','wallets','scan_sessions','point_events',
        'redemptions','fraud_flags']
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

-- Check: should list 13 tables
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1;
