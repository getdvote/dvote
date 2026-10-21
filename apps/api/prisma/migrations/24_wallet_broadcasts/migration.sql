ALTER TABLE vendors ADD COLUMN IF NOT EXISTS wallet_nearby_enabled boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS wallet_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id),
  created_by uuid NOT NULL REFERENCES staff_users(id),
  title varchar(80) NOT NULL,
  body varchar(500) NOT NULL,
  audience jsonb NOT NULL,
  idempotency_key varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vendor_id, idempotency_key), UNIQUE(id, vendor_id)
);
CREATE TABLE IF NOT EXISTS wallet_broadcast_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  card_id uuid NOT NULL,
  google_object_id text NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','accepted','skipped','failed','unknown')),
  reason varchar(60),
  attempted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(broadcast_id, card_id),
  FOREIGN KEY(broadcast_id, vendor_id) REFERENCES wallet_broadcasts(id, vendor_id),
  FOREIGN KEY(card_id, vendor_id) REFERENCES cards(id, vendor_id)
);
CREATE INDEX IF NOT EXISTS wallet_broadcasts_vendor_time ON wallet_broadcasts(vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wallet_broadcast_pending ON wallet_broadcast_recipients(created_at) WHERE status='pending';
CREATE INDEX IF NOT EXISTS wallet_broadcast_quota ON wallet_broadcast_recipients(card_id, attempted_at) WHERE status IN ('processing','accepted','unknown');
CREATE TRIGGER trg_wallet_broadcasts_updated BEFORE UPDATE ON wallet_broadcasts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_wallet_broadcast_recipients_updated BEFORE UPDATE ON wallet_broadcast_recipients FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE wallet_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_broadcast_recipients ENABLE ROW LEVEL SECURITY;
