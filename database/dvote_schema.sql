-- =====================================================================
--  dvote — Loyalty Platform schema (v2.0: spend-based points, rewards, one-time QR codes)
--  Target: PostgreSQL 18 (also runs on 13+)
--  Run in pgAdmin: open the Query Tool ON THE dvote DATABASE, paste, F5.
--  Wrapped in one transaction: if anything fails, nothing is created.
--
--  A database built from this file already matches every Prisma migration; mark them
--  applied (from apps/api):  npx prisma migrate resolve --applied <name>
--  for 0_init, 1_users_auth_user_id, 2_staff_users_auth_user_id, 3_points_rewards_qr,
--  4_platform_admins_auth_user_id, 5_users_gender_birth_date, 6_storage_images, 7_rewards_arabic,
--  ... through 18_drop_join_requests (section 9 below).
-- =====================================================================
BEGIN;

-- ---------------------------------------------------------------------
-- 1. ENUM TYPES
-- ---------------------------------------------------------------------
CREATE TYPE vendor_status       AS ENUM ('active', 'suspended');
CREATE TYPE branch_status       AS ENUM ('active', 'closed');
CREATE TYPE staff_role          AS ENUM ('vendor_admin', 'branch_manager', 'staff', 'viewer');  -- viewer: read-only, merchant-wide (migration 21)
CREATE TYPE account_status      AS ENUM ('active', 'disabled');          -- staff + platform admins
CREATE TYPE user_status         AS ENUM ('active', 'blocked');           -- customers
CREATE TYPE user_gender         AS ENUM ('male', 'female');              -- NULL = not given
CREATE TYPE auth_provider       AS ENUM ('google', 'facebook', 'apple');
CREATE TYPE reward_status       AS ENUM ('active', 'archived');
CREATE TYPE qr_purpose          AS ENUM ('collect', 'redeem');
CREATE TYPE qr_status           AS ENUM ('active', 'used', 'expired', 'cancelled');
CREATE TYPE point_event_type    AS ENUM ('earn', 'redeem', 'adjust');
CREATE TYPE fraud_flag_type     AS ENUM ('too_many_collects', 'large_purchase', 'branch_spike', 'staff_spike');
CREATE TYPE fraud_flag_status   AS ENUM ('open', 'dismissed', 'confirmed');
CREATE TYPE vendor_image_kind   AS ENUM ('menu', 'branch_photo');

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
    logo_path      varchar(300),                 -- uploaded logo in Storage bucket "vendors" (NULL = none / external URL)
    banner_url     varchar(500),                 -- shop-page banner (public link)
    banner_path    varchar(300),                 -- uploaded banner in Storage bucket "vendors" (<vendorId>/banner/…)
    category       varchar(40)   CONSTRAINT vendors_category_ck CHECK (
                       category IN ('cafe', 'cafe_restaurant', 'restaurant', 'bakery', 'desserts', 'juice_bar')),  -- NULL = not set
    card_design    smallint      CONSTRAINT vendors_card_design_ck CHECK (card_design BETWEEN 1 AND 10),     -- loyalty-card design; NULL = automatic
    contact_email  varchar(255),
    contact_phone  varchar(20)   CONSTRAINT vendors_contact_phone_ck CHECK (contact_phone ~ '^\+?[0-9]{6,15}$'),  -- e.g. +201001234567; NULL = not set
    currency       char(3)       NOT NULL DEFAULT 'EGP',    -- receipt totals are in this currency
    status         vendor_status NOT NULL DEFAULT 'active',
    created_at     timestamptz   NOT NULL DEFAULT now(),
    updated_at     timestamptz   NOT NULL DEFAULT now(),
    -- the public page (migration 22): sections in order, its style, brand colours and font
    storefront      jsonb         CONSTRAINT vendors_storefront_ck CHECK (storefront IS NULL OR jsonb_typeof(storefront) = 'object'),
    page_style      varchar(20)   CONSTRAINT vendors_page_style_ck CHECK (page_style IN ('spotlight', 'compact', 'branded', 'playful', 'split')),
    brand_primary   varchar(7),
    brand_secondary varchar(7),
    brand_font      varchar(40),
    CONSTRAINT vendors_brand_colors_ck CHECK (
        (brand_primary IS NULL OR brand_primary ~ '^#[0-9a-f]{6}$') AND
        (brand_secondary IS NULL OR brand_secondary ~ '^#[0-9a-f]{6}$'))
);

CREATE TABLE branches (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id   uuid          NOT NULL REFERENCES vendors (id),
    name        varchar(120)  NOT NULL,
    address     varchar(500),                -- street line; the city is separate
    city        varchar(40),                 -- key from the API's list of Egyptian cities (src/branches/cities.ts)
    lat         decimal(9,6)  CHECK (lat BETWEEN -90 AND 90),
    lng         decimal(9,6)  CHECK (lng BETWEEN -180 AND 180),
    timezone    varchar(64)   NOT NULL DEFAULT 'Africa/Cairo',
    opens_at    varchar(5),                -- legacy: "HH:MM" when every day has the same single slot, else NULL (kept by the API)
    closes_at   varchar(5),                -- earlier than opens_at = open past midnight
    weekly_hours jsonb,                    -- [{"day":0-6 (0=Sunday),"opensAt":"HH:MM","closesAt":"HH:MM"}], split shifts = several per day; no entry = closed that day; NULL = not set
    paused_until timestamptz,              -- temporarily closed until then (ends by itself)
    status      branch_status NOT NULL DEFAULT 'active',
    created_at  timestamptz   NOT NULL DEFAULT now(),
    updated_at  timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (id, vendor_id),         -- lets other tables prove "this branch belongs to this vendor"
    CONSTRAINT branches_hours_ck CHECK (
        (opens_at IS NULL AND closes_at IS NULL)
        OR (opens_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
            AND closes_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
            AND opens_at <> closes_at)
    ),
    CONSTRAINT branches_weekly_hours_ck CHECK (weekly_hours IS NULL OR jsonb_typeof(weekly_hours) = 'array'),
    storefront  jsonb CONSTRAINT branches_storefront_ck CHECK (storefront IS NULL OR jsonb_typeof(storefront) = 'object')  -- this branch's own storefront (migration 22); NULL = the shop's
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
        (role IN ('vendor_admin', 'viewer') AND branch_id IS NULL) OR
        (role NOT IN ('vendor_admin', 'viewer') AND branch_id IS NOT NULL)
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
    name_ar        varchar(120),               -- Arabic (optional; the app falls back to name)
    description_ar varchar(500),               -- Arabic (optional)
    image_url    varchar(500),
    image_path   varchar(300),                -- uploaded photo in Storage bucket "vendors" (<vendorId>/rewards/…)
    points_cost  int           NOT NULL CHECK (points_cost > 0),
    retail_value numeric(12,2) CHECK (retail_value > 0 AND retail_value <= 99999999.99),
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
    avatar_url  varchar(500),                 -- sign-in provider photo (Google/Facebook)
    avatar_path varchar(300),                 -- uploaded photo in private Storage bucket "avatars"
    last_lat    decimal(9,6) CHECK (last_lat BETWEEN -90 AND 90),     -- last known location (app open, with permission): nearby shops
    last_lng    decimal(9,6) CHECK (last_lng BETWEEN -180 AND 180),
    last_location_at timestamptz,
    phone       varchar(20),                  -- optional, not used for login
    gender      user_gender,                  -- optional (profile)
    birth_date  date,                         -- optional (profile); plain date, no time zone
    auth_user_id uuid,                        -- Supabase Auth user id
    status      user_status NOT NULL DEFAULT 'active',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT users_birth_date_ck CHECK (birth_date >= DATE '1900-01-01')
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
-- 6b. VENDOR IMAGES (files in Supabase Storage bucket "vendors"; rows hard-deleted with their file)
-- ---------------------------------------------------------------------
CREATE TABLE vendor_images (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id     uuid              NOT NULL REFERENCES vendors (id),
    branch_id     uuid,                                 -- branch photos only
    kind          vendor_image_kind NOT NULL,
    storage_path  varchar(300)      NOT NULL UNIQUE,    -- <vendor>/menu/<f>.webp | <vendor>/branches/<branch>/<f>.webp
    sort_order    integer           NOT NULL DEFAULT 0,
    created_at    timestamptz       NOT NULL DEFAULT now(),
    updated_at    timestamptz       NOT NULL DEFAULT now(),
    CONSTRAINT vendor_images_branch_fk FOREIGN KEY (branch_id, vendor_id) REFERENCES branches (id, vendor_id),
    CONSTRAINT vendor_images_kind_ck CHECK (
        (kind = 'menu' AND branch_id IS NULL) OR
        (kind = 'branch_photo' AND branch_id IS NOT NULL)
    )
);
CREATE INDEX vendor_images_vendor_idx ON vendor_images (vendor_id, kind, branch_id, sort_order);

-- ---------------------------------------------------------------------
-- 6c. REWARD SOLD-OUTS (per branch; sold out while sold_out_until IS NULL or > now();
--     "available again" sets sold_out_until = now(), rows are never deleted)
-- ---------------------------------------------------------------------
CREATE TABLE reward_sold_outs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id       uuid        NOT NULL REFERENCES vendors (id),
    reward_id       uuid        NOT NULL,
    branch_id       uuid        NOT NULL,
    sold_out_until  timestamptz,                              -- NULL = until turned back on
    set_by_staff_id uuid        REFERENCES staff_users (id),  -- who last changed it (NULL = dvote admin)
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT reward_sold_outs_reward_fk FOREIGN KEY (reward_id, vendor_id) REFERENCES rewards (id, vendor_id),
    CONSTRAINT reward_sold_outs_branch_fk FOREIGN KEY (branch_id, vendor_id) REFERENCES branches (id, vendor_id),
    CONSTRAINT reward_sold_outs_uq UNIQUE (reward_id, branch_id)
);
CREATE INDEX reward_sold_outs_vendor_idx ON reward_sold_outs (vendor_id, branch_id);

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
    key          varchar(200)      UNIQUE,                         -- one flag per finding (set by the fraud check)
    created_at   timestamptz       NOT NULL DEFAULT now(),
    updated_at   timestamptz       NOT NULL DEFAULT now(),
    CONSTRAINT fraud_flags_target_ck CHECK (num_nonnulls(vendor_id, branch_id, user_id, staff_id) >= 1),
    CONSTRAINT fraud_flags_review_ck CHECK (status = 'open' OR reviewed_by IS NOT NULL)
);
CREATE INDEX fraud_flags_status_time_idx ON fraud_flags (status, created_at);
CREATE INDEX fraud_flags_vendor_idx ON fraud_flags (vendor_id);

-- Custom customer segments (migration 20): rules and/or customers added by hand.
CREATE TABLE customer_segments (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           uuid         NOT NULL REFERENCES vendors (id),
    name                varchar(60)  NOT NULL CHECK (btrim(name) <> ''),
    description         varchar(300),
    match               varchar(3)   NOT NULL DEFAULT 'all' CHECK (match IN ('all', 'any')),
    rules               jsonb        NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(rules) = 'array'),  -- [{field, op, value}], checked by the API
    sort_order          int          NOT NULL DEFAULT 0,
    status              varchar(10)  NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by_staff_id uuid         REFERENCES staff_users (id),
    created_at          timestamptz  NOT NULL DEFAULT now(),
    updated_at          timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (id, vendor_id)
);
CREATE UNIQUE INDEX customer_segments_name_uq ON customer_segments (vendor_id, lower(name)) WHERE status = 'active';

-- included = added by hand, false = removed by hand (beats the rules)
CREATE TABLE customer_segment_members (
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
CREATE INDEX customer_segment_members_card_idx ON customer_segment_members (vendor_id, card_id);

-- ---------------------------------------------------------------------
-- 8. TRIGGERS
-- ---------------------------------------------------------------------
-- updated_at on every table
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'platform_admins','vendors','branches','staff_users','point_rules','rewards',
        'users','user_identities','cards','qr_codes','point_events','redemptions','fraud_flags',
        'vendor_images','reward_sold_outs','customer_segments','customer_segment_members']
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

-- ---------------------------------------------------------------------
-- 9. WALLET JOIN (migrations 16_wallet_join, 17_vendor_slug_default,
--    18_drop_join_requests, 2026-10-17): merchant slugs, web customers,
--    wallet cards, wallet_registrations (Apple), card scans. Same SQL as
--    the migrations (join_requests is created by 16 and dropped by 18).
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. vendors.slug: the public address dvote.app/<slug>
-- ---------------------------------------------------------------------
ALTER TABLE vendors ADD COLUMN slug varchar(50);

-- Words the public site uses for its own pages: never a merchant slug.
CREATE FUNCTION vendor_slug_reserved(s text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
    SELECT s IN ('api', 'admin', 'app', 'c', 'card', 'cards', 'join', 'w', 't', 'www', 'help',
                 'privacy', 'terms', 'about', 'login', 'dashboard', 'staff', 'static', 'assets', 'dvote')
$$;

-- A free slug from a name: "Joy Corner" -> joy-corner, then joy-corner-2, -3 ... if taken.
-- Names without Latin letters (e.g. Arabic) become "shop", "shop-2", ...
CREATE FUNCTION vendor_slug_from(name text, own_id uuid) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
    base text := left(trim(both '-' from regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '-', 'g')), 44);
    candidate text;
    n int := 1;
BEGIN
    -- one slug pick at a time, so two merchants created at once never get the same slug
    PERFORM pg_advisory_xact_lock(hashtext('vendor_slug'));
    base := trim(both '-' from base);
    IF length(base) < 2 THEN base := 'shop'; END IF;
    IF vendor_slug_reserved(base) THEN base := base || '-shop'; END IF;
    candidate := base;
    WHILE EXISTS (SELECT 1 FROM vendors WHERE slug = candidate AND id IS DISTINCT FROM own_id) LOOP
        n := n + 1;
        candidate := base || '-' || n;
    END LOOP;
    RETURN candidate;
END;
$$;

-- Fill the slug of every new merchant that is created without one (admin API, tests, seeds).
CREATE FUNCTION vendors_fill_slug() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := vendor_slug_from(NEW.name, NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER vendors_fill_slug BEFORE INSERT ON vendors
    FOR EACH ROW EXECUTE FUNCTION vendors_fill_slug();

-- existing merchants, oldest first (so the first "Joy Corner" keeps "joy-corner")
DO $$
DECLARE v record;
BEGIN
    FOR v IN SELECT id, name FROM vendors ORDER BY created_at, id LOOP
        UPDATE vendors SET slug = vendor_slug_from(v.name, v.id) WHERE id = v.id;
    END LOOP;
END $$;

ALTER TABLE vendors ALTER COLUMN slug SET NOT NULL;
ALTER TABLE vendors ADD CONSTRAINT vendors_slug_ck
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 2 AND 50 AND NOT vendor_slug_reserved(slug));
CREATE UNIQUE INDEX vendors_slug_uq ON vendors (slug);

-- ---------------------------------------------------------------------
-- 2. users: customers joining from the web (no Supabase account needed)
-- ---------------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN email_verified_at timestamptz,  -- set when the join code was confirmed
    ADD COLUMN age_confirmed_at  timestamptz;  -- "I'm 14 or older" ticked on the join form

-- one customer per email: someone joining three merchants is one user with three cards
CREATE UNIQUE INDEX users_email_uq ON users (lower(email)) WHERE email IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. cards: the wallet pass of one customer at one merchant
--    (now created when the customer joins, balance 0; the app still makes
--    them on the first purchase)
-- ---------------------------------------------------------------------
ALTER TABLE cards
    -- unguessable id in the card page link (dvote.app/c/<public_id>) and the Apple pass serial
    ADD COLUMN public_id        varchar(32) NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
    -- SHA-256 of the card QR secret ("dvote:c1:<secret>" on the pass); NULL until a pass is issued
    ADD COLUMN token_hash       char(64),
    -- human code printed on the pass, e.g. CZW-QNM (staff can type it if the camera fails)
    ADD COLUMN short_code       varchar(8),
    ADD COLUMN joined_via       varchar(10) CONSTRAINT cards_joined_via_ck CHECK (joined_via IN ('nfc', 'qr', 'link', 'app')),
    ADD COLUMN joined_branch_id uuid,
    ADD COLUMN heard_from       varchar(40),          -- "How did you hear about us?" (optional)
    ADD COLUMN google_object_id varchar(200),         -- Google Wallet LoyaltyObject id
    ADD COLUMN apple_auth_token varchar(64),          -- PassKit web-service token of this pass
    ADD COLUMN pass_updated_at  timestamptz,          -- last balance pushed to the wallets
    ADD CONSTRAINT cards_joined_branch_fk FOREIGN KEY (joined_branch_id, vendor_id) REFERENCES branches (id, vendor_id),
    ADD CONSTRAINT cards_short_code_ck CHECK (short_code ~ '^[A-Z0-9]{3}-[A-Z0-9]{3}$');

CREATE UNIQUE INDEX cards_public_id_uq  ON cards (public_id);
CREATE UNIQUE INDEX cards_token_hash_uq ON cards (token_hash) WHERE token_hash IS NOT NULL;
CREATE UNIQUE INDEX cards_short_code_uq ON cards (vendor_id, short_code) WHERE short_code IS NOT NULL;

-- ---------------------------------------------------------------------
-- 4. join_requests: a join form waiting for its email code
--    (the card is created only after the code is confirmed)
-- ---------------------------------------------------------------------
CREATE TABLE join_requests (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id     uuid         NOT NULL REFERENCES vendors (id),
    branch_id     uuid,                                   -- branch of the tag / QR, if any
    email         varchar(255) NOT NULL,                  -- stored lower-case
    name          varchar(120) NOT NULL,
    phone         varchar(20)  NOT NULL,                  -- Egyptian mobile, +201XXXXXXXXX
    heard_from    varchar(40),
    source        varchar(10)  NOT NULL CONSTRAINT join_requests_source_ck CHECK (source IN ('nfc', 'qr', 'link')),
    code_hash     char(64)     NOT NULL,                  -- SHA-256 of the 6-digit email code
    attempts      smallint     NOT NULL DEFAULT 0,        -- wrong codes typed
    expires_at    timestamptz  NOT NULL,
    verified_at   timestamptz,                            -- code confirmed
    card_id       uuid         REFERENCES cards (id),     -- the card it created
    created_at    timestamptz  NOT NULL DEFAULT now(),
    updated_at    timestamptz  NOT NULL DEFAULT now(),
    FOREIGN KEY (branch_id, vendor_id) REFERENCES branches (id, vendor_id),
    CONSTRAINT join_requests_email_ck CHECK (email = lower(email)),
    CONSTRAINT join_requests_phone_ck CHECK (phone ~ '^\+201[0125][0-9]{8}$'),
    CONSTRAINT join_requests_verified_ck CHECK (verified_at IS NULL OR card_id IS NOT NULL)
);
CREATE INDEX join_requests_email_idx ON join_requests (email, created_at);
CREATE INDEX join_requests_vendor_idx ON join_requests (vendor_id, created_at);

CREATE TRIGGER join_requests_set_updated_at BEFORE UPDATE ON join_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 5. wallet_registrations: iPhones holding a card's Apple pass
--    (Apple's PassKit web service: we push to them when points change)
-- ---------------------------------------------------------------------
CREATE TABLE wallet_registrations (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id            uuid         NOT NULL REFERENCES cards (id),
    device_library_id  varchar(128) NOT NULL,
    push_token         varchar(256) NOT NULL,
    created_at         timestamptz  NOT NULL DEFAULT now(),
    updated_at         timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (device_library_id, card_id)
);
CREATE INDEX wallet_registrations_card_idx ON wallet_registrations (card_id);

CREATE TRIGGER wallet_registrations_set_updated_at BEFORE UPDATE ON wallet_registrations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 6. point_events: a collect / redeem can come from a wallet card scan
--    (no qr_codes row). Old rows keep scan_source NULL = app QR.
-- ---------------------------------------------------------------------
ALTER TABLE point_events
    ADD COLUMN scan_source varchar(12) CONSTRAINT point_events_scan_source_ck
        CHECK (scan_source IN ('app_qr', 'wallet_card'));

ALTER TABLE point_events DROP CONSTRAINT point_events_rules_ck;
ALTER TABLE point_events ADD CONSTRAINT point_events_rules_ck CHECK (
    (type = 'earn' AND delta > 0 AND purchase_amount > 0 AND rule_id IS NOT NULL
        AND reward_id IS NULL AND staff_id IS NOT NULL AND branch_id IS NOT NULL
        AND (qr_code_id IS NOT NULL OR scan_source = 'wallet_card')) OR
    (type = 'redeem' AND delta < 0 AND reward_id IS NOT NULL
        AND staff_id IS NOT NULL AND branch_id IS NOT NULL
        AND (qr_code_id IS NOT NULL OR scan_source = 'wallet_card')) OR
    (type = 'adjust' AND delta <> 0 AND created_by IS NOT NULL AND reason IS NOT NULL)
);

-- The slug is filled by the vendors_fill_slug trigger (16_wallet_join) when a merchant is created
-- without one. An empty default lets the code (Prisma) leave it out; the BEFORE INSERT trigger
-- replaces '' with a free slug from the name before the CHECK and unique index apply.
ALTER TABLE vendors ALTER COLUMN slug SET DEFAULT '';

-- Join verification moved to Supabase Auth (decided 2026-10-17, option A): the web join page signs
-- the customer in with "Continue with Google" or Supabase's email one-time code, and the API trusts
-- the verified email in that token. Our own email-code table (16_wallet_join) is not needed; it
-- never held data.
DROP TABLE join_requests;

COMMIT;

-- Check: should list 16 tables (15 + wallet_registrations)
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name <> '_prisma_migrations' ORDER BY 1;
