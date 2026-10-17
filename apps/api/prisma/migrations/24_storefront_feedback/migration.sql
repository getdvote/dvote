CREATE TABLE vendor_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id),
  branch_id uuid,
  card_id uuid,
  name varchar(120) NOT NULL CHECK (length(trim(name)) > 0),
  phone varchar(20),
  message varchar(2000) NOT NULL CHECK (length(trim(message)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (branch_id, vendor_id) REFERENCES branches(id, vendor_id),
  FOREIGN KEY (card_id, vendor_id) REFERENCES cards(id, vendor_id)
);
CREATE INDEX vendor_feedback_vendor_created_idx ON vendor_feedback(vendor_id, created_at DESC, id DESC);
ALTER TABLE vendor_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vendor_feedback FROM anon, authenticated;
