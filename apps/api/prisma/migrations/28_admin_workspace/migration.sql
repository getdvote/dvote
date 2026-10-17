-- Platform operations have their own actor; never attribute them to merchant staff.
ALTER TABLE qr_codes ADD COLUMN used_by_admin_id uuid REFERENCES platform_admins(id);
ALTER TABLE qr_codes DROP CONSTRAINT qr_used_ck;
ALTER TABLE qr_codes ADD CONSTRAINT qr_used_ck CHECK (status <> 'used' OR
  (used_at IS NOT NULL AND used_branch_id IS NOT NULL AND num_nonnulls(used_by_staff_id,used_by_admin_id)=1));
ALTER TABLE point_events DROP CONSTRAINT point_events_rules_ck;
ALTER TABLE point_events ADD CONSTRAINT point_events_rules_ck CHECK (
 (type='earn' AND delta>0 AND purchase_amount>0 AND rule_id IS NOT NULL AND reward_id IS NULL
   AND num_nonnulls(staff_id,created_by)=1 AND branch_id IS NOT NULL AND (qr_code_id IS NOT NULL OR scan_source='wallet_card')) OR
 (type='redeem' AND delta<0 AND reward_id IS NOT NULL AND num_nonnulls(staff_id,created_by)=1
   AND branch_id IS NOT NULL AND (qr_code_id IS NOT NULL OR scan_source='wallet_card')) OR
 (type='adjust' AND delta<>0 AND created_by IS NOT NULL AND reason IS NOT NULL));
ALTER TABLE redemptions ALTER COLUMN staff_id DROP NOT NULL;
ALTER TABLE redemptions ADD COLUMN created_by_admin_id uuid REFERENCES platform_admins(id);
ALTER TABLE redemptions ADD CONSTRAINT redemptions_actor_ck CHECK (num_nonnulls(staff_id,created_by_admin_id)=1);
ALTER TABLE wallet_broadcasts ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE wallet_broadcasts ADD COLUMN created_by_admin_id uuid REFERENCES platform_admins(id);
ALTER TABLE wallet_broadcasts ADD CONSTRAINT wallet_broadcasts_actor_ck CHECK (num_nonnulls(created_by,created_by_admin_id)=1);
CREATE TABLE admin_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 admin_id uuid NOT NULL REFERENCES platform_admins(id),
 vendor_id uuid NOT NULL REFERENCES vendors(id),
 method varchar(8) NOT NULL,
 path varchar(300) NOT NULL,
 status varchar(12) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','succeeded','failed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_actions_vendor_time_idx ON admin_actions(vendor_id,created_at DESC);
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON admin_actions FROM anon; END IF;
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON admin_actions FROM authenticated; END IF;
END $$;
