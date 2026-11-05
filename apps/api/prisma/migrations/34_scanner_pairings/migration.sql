-- Phone scanner pairing (decided 2026-11-05): the Scan page shows a QR + 6-digit code, and a phone
-- that enters the code gets a session limited to scanning for 12 hours. Scans count under the staff
-- member who paired, at the pairing's branch. Only hashes are stored. Rows are kept as the record
-- of who paired what. Staff changes revoke a pairing for good; shop and branch locks only pause it,
-- worked out at read time, so they write nothing here.
-- lets the pairing's staff member be tied to its vendor, the same way as branches
ALTER TABLE staff_users ADD CONSTRAINT staff_users_id_vendor_uq UNIQUE (id, vendor_id);

CREATE TABLE scanner_pairings (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           uuid        NOT NULL REFERENCES vendors (id),
    branch_id           uuid        NOT NULL,
    staff_id            uuid        NOT NULL,
    secret_hash         char(64)    NOT NULL UNIQUE,
    code_hash           char(64)    NOT NULL,
    code_expires_at     timestamptz NOT NULL,
    failed_attempts     integer     NOT NULL DEFAULT 0,
    session_token_hash  char(64)    UNIQUE,
    claimed_at          timestamptz,
    session_expires_at  timestamptz,
    revoked_at          timestamptz,
    revoked_by_staff_id uuid        REFERENCES staff_users (id),
    revoked_reason      varchar(20),
    device_label        varchar(30),
    last_used_at        timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT scanner_pairings_branch_fk FOREIGN KEY (branch_id, vendor_id) REFERENCES branches (id, vendor_id),
    CONSTRAINT scanner_pairings_staff_fk FOREIGN KEY (staff_id, vendor_id) REFERENCES staff_users (id, vendor_id),
    CONSTRAINT scanner_pairings_reason_ck CHECK (
      revoked_reason IN ('disconnected', 'ended_by_phone', 'staff_disabled', 'role_changed', 'branch_changed')
    ),
    CONSTRAINT scanner_pairings_revoked_ck CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL)),
    CONSTRAINT scanner_pairings_claimed_ck CHECK (
      (claimed_at IS NULL AND session_token_hash IS NULL AND session_expires_at IS NULL)
      OR (claimed_at IS NOT NULL AND session_token_hash IS NOT NULL AND session_expires_at IS NOT NULL)
    )
);
CREATE INDEX scanner_pairings_vendor_staff_idx ON scanner_pairings (vendor_id, staff_id);

CREATE TRIGGER scanner_pairings_set_updated_at BEFORE UPDATE ON scanner_pairings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE scanner_pairings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON scanner_pairings FROM anon; END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON scanner_pairings FROM authenticated; END IF;
END $$;
