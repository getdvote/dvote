-- =====================================================================
--  dvote — development seed (v2.0): Joy Corner
--  Run on the dvote database AFTER dvote_schema.sql (or the Prisma migrations).
--  Safe to run again: existing rows (same ids) are left unchanged.
-- =====================================================================
BEGIN;

-- Vendor + one branch
INSERT INTO vendors (id, name, contact_email, currency)
VALUES ('11111111-0000-0000-0000-000000000001', 'Joy Corner', NULL, 'EGP')
ON CONFLICT (id) DO NOTHING;

INSERT INTO branches (id, vendor_id, name, address, timezone)
VALUES ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
        'Joy Corner Smouha', 'Smouha, Alexandria', 'Africa/Cairo')
ON CONFLICT (id) DO NOTHING;

-- Earning rule v1: every 10.00 EGP spent = 1 point (no minimum, no cap)
INSERT INTO point_rules (id, vendor_id, version, spend_amount, points_per_spend, min_purchase, is_active)
VALUES ('44444444-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
        1, 10.00, 1, 0, true)
ON CONFLICT (id) DO NOTHING;

-- Reward catalogue
INSERT INTO rewards (id, vendor_id, name, description, name_ar, description_ar, points_cost, sort_order) VALUES
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
   'Free coffee', 'Any coffee, any size',
   'قهوة مجانية', 'أي قهوة، أي حجم', 300, 1),
  ('33333333-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001',
   'Free cheesecake', 'One slice of cheesecake',
   'تشيز كيك مجاني', 'شريحة واحدة من التشيز كيك', 500, 2),
  ('33333333-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001',
   'Free coffee + cheesecake', 'Any coffee and one slice of cheesecake',
   'قهوة + تشيز كيك مجانًا', 'أي قهوة وشريحة واحدة من التشيز كيك', 750, 3)
ON CONFLICT (id) DO NOTHING;

COMMIT;
