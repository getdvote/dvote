-- =====================================================================
--  16_wallet_join (2026-10-17): wallet passes instead of the customer app.
--
--  A customer opens dvote.app/<merchant-slug> from the NFC tag / QR at the
--  till, fills the join form, confirms the email with a one-time code, and
--  gets a loyalty card for that merchant as a Google / Apple Wallet pass.
--  Staff scan the pass QR (a static card token) instead of a one-time QR.
--
--  Additive only: the paused customer app (one-time QR codes) keeps working.
-- =====================================================================

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
