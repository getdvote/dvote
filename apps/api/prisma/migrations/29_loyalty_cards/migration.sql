-- =====================================================================
--  29_loyalty_cards (2026-10-19): the merchant's loyalty card as its own record.
--
--  One card per merchant (the wallet pass customers add). Its look is a JSON
--  document saved as immutable versions (V1, V2, ...); live_version_id points
--  at the one the passes show, so a merchant can go back to V1 and forward
--  to V5 again. status: active / paused (no new sign-ups) / cancelled
--  (restorable for 30 days; balances and ledger are kept).
--
--  Every existing merchant gets its card + V1, drawn in the colour its pass
--  already has, so members notice nothing. Additive only.
-- =====================================================================

CREATE TABLE loyalty_cards (
    id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id        uuid         NOT NULL REFERENCES vendors (id),
    name             varchar(60)  NOT NULL,
    status           varchar(10)  NOT NULL DEFAULT 'active'
                     CONSTRAINT loyalty_cards_status_ck CHECK (status IN ('active', 'paused', 'cancelled')),
    cancelled_at     timestamptz,
    live_version_id  uuid,
    created_at       timestamptz  NOT NULL DEFAULT now(),
    updated_at       timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT loyalty_cards_vendor_uq UNIQUE (vendor_id),
    CONSTRAINT loyalty_cards_id_vendor_uq UNIQUE (id, vendor_id),
    CONSTRAINT loyalty_cards_cancelled_ck CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))
);

CREATE TRIGGER trg_loyalty_cards_updated BEFORE UPDATE ON loyalty_cards
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE loyalty_card_versions (
    id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id              uuid        NOT NULL,
    vendor_id            uuid        NOT NULL,
    number               int         NOT NULL CONSTRAINT loyalty_card_versions_number_ck CHECK (number >= 1),
    design               jsonb       NOT NULL CONSTRAINT loyalty_card_versions_design_ck CHECK (jsonb_typeof(design) = 'object'),
    created_by_staff_id  uuid        REFERENCES staff_users (id),
    created_by_admin_id  uuid        REFERENCES platform_admins (id),
    created_at           timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT loyalty_card_versions_number_uq UNIQUE (card_id, number),
    CONSTRAINT loyalty_card_versions_id_card_uq UNIQUE (id, card_id),
    FOREIGN KEY (card_id, vendor_id) REFERENCES loyalty_cards (id, vendor_id)
);

-- the live version must be one of the card's own versions
ALTER TABLE loyalty_cards ADD CONSTRAINT loyalty_cards_live_version_fk
    FOREIGN KEY (live_version_id, id) REFERENCES loyalty_card_versions (id, card_id)
    DEFERRABLE INITIALLY DEFERRED;

-- ---------------------------------------------------------------------
-- One card + V1 for every existing merchant, in the colour its pass has now
-- (the old automatic design: same hash as cardDesign() in the dashboard).
-- ---------------------------------------------------------------------
DO $$
DECLARE
    colors text[] := ARRAY['#1C1C1E','#2E9E6B','#2F6BDE','#F2B33D','#6155F5','#E0533D','#0E8C99','#3E2723','#AD1457','#E9DCC9'];
    inks   text[] := ARRAY['#FFFFFF','#FFFFFF','#FFFFFF','#1C1C1E','#FFFFFF','#FFFFFF','#FFFFFF','#FFFFFF','#FFFFFF','#3E2723'];
    v record;
    h bigint;
    i int;
    idx int;
    card uuid;
    ver uuid;
BEGIN
    FOR v IN SELECT id, name, card_design FROM vendors LOOP
        IF v.card_design BETWEEN 1 AND 10 THEN
            idx := v.card_design;
        ELSE
            h := 0;
            FOR i IN 1..length(v.id::text) LOOP
                h := (h * 31 + ascii(substr(v.id::text, i, 1))) % 4294967296;
            END LOOP;
            idx := (h % 10) + 1;
        END IF;
        card := gen_random_uuid();
        ver := gen_random_uuid();
        INSERT INTO loyalty_cards (id, vendor_id, name, live_version_id)
            VALUES (card, v.id, left(v.name, 60), ver);
        INSERT INTO loyalty_card_versions (id, card_id, vendor_id, number, design) VALUES (ver, card, v.id, 1, jsonb_build_object(
            'colors', jsonb_build_object('background', colors[idx], 'text', inks[idx], 'label', inks[idx],
                                         'useBrand', false, 'autoText', true, 'autoLabel', true),
            'background', jsonb_build_object('style', 'solid', 'imageUrl', null, 'imagePath', null),
            'front', jsonb_build_object(
                'title', jsonb_build_object('en', left(v.name, 40), 'ar', ''),
                'pointsLabel', jsonb_build_object('en', 'Points', 'ar', 'النقاط')),
            'buttons', jsonb_build_object(
                'primaryLabel', jsonb_build_object('en', 'Offers & Rewards', 'ar', 'العروض والمكافآت'),
                'secondary', jsonb_build_object('type', 'none')),
            'back', jsonb_build_object('about', '', 'hours', '[]'::jsonb, 'links', '[]'::jsonb, 'terms', '')));
    END LOOP;
END $$;

-- check the deferred live-version key now (ALTER TABLE refuses pending trigger events)
SET CONSTRAINTS loyalty_cards_live_version_fk IMMEDIATE;

ALTER TABLE loyalty_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_card_versions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON loyalty_cards, loyalty_card_versions FROM anon;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON loyalty_cards, loyalty_card_versions FROM authenticated;
    END IF;
END $$;
