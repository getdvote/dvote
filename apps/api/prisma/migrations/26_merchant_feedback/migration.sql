-- Quick feedback from merchant teams about dvote (Get help dialog), read by platform admins.
CREATE TABLE merchant_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id),
  staff_id uuid NOT NULL REFERENCES staff_users(id),
  mood varchar(10) CHECK (mood IN ('love', 'okay', 'unhappy')),
  message varchar(2000) NOT NULL CHECK (length(trim(message)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX merchant_feedback_created_idx ON merchant_feedback(created_at DESC, id DESC);
CREATE INDEX merchant_feedback_vendor_idx ON merchant_feedback(vendor_id, created_at DESC);
ALTER TABLE merchant_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON merchant_feedback FROM anon, authenticated;
