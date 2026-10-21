ALTER TABLE wallet_broadcasts ALTER COLUMN body TYPE varchar(2000);
ALTER TABLE vendors ADD COLUMN wallet_nearby_branch_ids uuid[];
CREATE TABLE wallet_campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 vendor_id uuid NOT NULL REFERENCES vendors(id),
 actor jsonb NOT NULL,
 name varchar(80) NOT NULL,
 body varchar(2000) NOT NULL,
 audience jsonb NOT NULL DEFAULT '{}',
 status text NOT NULL CHECK(status IN ('draft','scheduled','repeating','processing','sent','failed','cancelled')),
 next_at timestamptz,
 repeat_days integer CHECK(repeat_days IN (1,7,30)),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_campaigns_due ON wallet_campaigns(next_at) WHERE status IN ('scheduled','repeating','processing');
ALTER TABLE wallet_campaigns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON wallet_campaigns FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON wallet_campaigns FROM anon; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON wallet_campaigns FROM authenticated; END IF;
END $$;
