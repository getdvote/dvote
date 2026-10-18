-- =====================================================================
-- dvote: DELETE ONE MERCHANT (vendor) AND ALL ITS DATA
-- =====================================================================
-- Removes the merchant and everything that belongs to it: branches,
-- staff, point rules, rewards, sold-outs, images (rows), storefront,
-- cards, the points ledger and redemptions at this merchant, QR codes
-- used there, segments, feedback, wallet messages and registrations,
-- fraud flags and admin audit rows about it.
--
-- Customers are shared between merchants: a customer is deleted only
-- when, after this, they have no card anywhere and no sign-in account.
-- Other merchants are never touched. This CANNOT be undone.
--
-- How to run (Supabase dashboard → SQL Editor), all in ONE run:
--   1. Paste this whole file.
--   2. Fill in the two lines below: the vendor id AND its exact name
--      (the name must match, so a wrong id deletes nothing).
--   3. Run. Any problem → everything is rolled back, nothing deleted.
--
-- Not covered (do it in the Supabase dashboard afterwards):
--   - Image files: Storage → bucket `vendors` → folder named <vendor id> → Delete.
--   - Staff sign-in accounts: optional part B below.
-- =====================================================================

BEGIN;

SET LOCAL dvote.vendor_id   = '00000000-0000-0000-0000-000000000000';  -- ← the vendor id
SET LOCAL dvote.vendor_name = '';                                      -- ← its exact name

-- Part B (optional): also delete the Supabase sign-in accounts of this
-- merchant's staff (only accounts not used by another merchant, a platform
-- admin or a customer). Change 'no' to 'yes' to include it.
SET LOCAL dvote.delete_staff_logins = 'no';

DO $$
DECLARE
  v        uuid := current_setting('dvote.vendor_id')::uuid;
  v_name   text;
  n        bigint;
  logins   uuid[];
  users_   uuid[];
BEGIN
  SELECT name INTO v_name FROM vendors WHERE id = v;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'No merchant with id %. Nothing was deleted.', v;
  END IF;
  IF v_name IS DISTINCT FROM current_setting('dvote.vendor_name') THEN
    RAISE EXCEPTION 'Name does not match: the merchant % is called "%". Nothing was deleted.', v, v_name;
  END IF;
  RAISE NOTICE 'Deleting merchant "%" (%)', v_name, v;

  -- remember who to clean up afterwards
  SELECT array_agg(DISTINCT user_id) INTO users_ FROM cards WHERE vendor_id = v;
  SELECT array_agg(DISTINCT auth_user_id) INTO logins FROM staff_users WHERE vendor_id = v AND auth_user_id IS NOT NULL;

  -- the ledger refuses DELETE by design: switch that rule off for this transaction only
  ALTER TABLE point_events DISABLE TRIGGER point_events_no_update;

  -- children first, the merchant last (foreign keys stay checked the whole time)
  IF to_regclass('public.wallet_registrations') IS NOT NULL THEN
    DELETE FROM wallet_registrations WHERE card_id IN (SELECT id FROM cards WHERE vendor_id = v);
  END IF;
  IF to_regclass('public.wallet_broadcast_recipients') IS NOT NULL THEN
    DELETE FROM wallet_broadcast_recipients WHERE vendor_id = v;
  END IF;
  IF to_regclass('public.wallet_broadcasts') IS NOT NULL THEN
    DELETE FROM wallet_broadcasts WHERE vendor_id = v;
  END IF;
  IF to_regclass('public.customer_segment_members') IS NOT NULL THEN
    DELETE FROM customer_segment_members WHERE vendor_id = v;
  END IF;
  IF to_regclass('public.customer_segments') IS NOT NULL THEN
    DELETE FROM customer_segments WHERE vendor_id = v;
  END IF;
  IF to_regclass('public.vendor_feedback') IS NOT NULL THEN
    DELETE FROM vendor_feedback WHERE vendor_id = v;
  END IF;
  IF to_regclass('public.merchant_feedback') IS NOT NULL THEN
    DELETE FROM merchant_feedback WHERE vendor_id = v;
  END IF;
  DELETE FROM fraud_flags
   WHERE vendor_id = v
      OR branch_id IN (SELECT id FROM branches WHERE vendor_id = v)
      OR staff_id  IN (SELECT id FROM staff_users WHERE vendor_id = v);
  IF to_regclass('public.admin_actions') IS NOT NULL THEN
    DELETE FROM admin_actions WHERE vendor_id = v;
  END IF;
  DELETE FROM redemptions  WHERE vendor_id = v;
  DELETE FROM point_events WHERE vendor_id = v;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Ledger rows deleted: %', n;
  DELETE FROM qr_codes
   WHERE vendor_id = v
      OR used_branch_id   IN (SELECT id FROM branches WHERE vendor_id = v)
      OR used_by_staff_id IN (SELECT id FROM staff_users WHERE vendor_id = v)
      OR reward_id        IN (SELECT id FROM rewards WHERE vendor_id = v);
  DELETE FROM reward_sold_outs WHERE vendor_id = v;
  DELETE FROM vendor_images    WHERE vendor_id = v;
  DELETE FROM cards            WHERE vendor_id = v;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Cards deleted: %', n;
  DELETE FROM point_rules      WHERE vendor_id = v;
  DELETE FROM rewards          WHERE vendor_id = v;
  DELETE FROM staff_users      WHERE vendor_id = v;
  DELETE FROM branches         WHERE vendor_id = v;
  DELETE FROM vendors          WHERE id = v;

  ALTER TABLE point_events ENABLE TRIGGER point_events_no_update;

  -- customers who now have no card anywhere and no sign-in account
  DELETE FROM user_identities WHERE user_id = ANY (coalesce(users_, '{}'))
     AND user_id NOT IN (SELECT user_id FROM cards)
     AND user_id IN (SELECT id FROM users WHERE auth_user_id IS NULL);
  DELETE FROM users u
   WHERE u.id = ANY (coalesce(users_, '{}'))
     AND u.auth_user_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM cards c WHERE c.user_id = u.id)
     AND NOT EXISTS (SELECT 1 FROM qr_codes q WHERE q.user_id = u.id)
     AND NOT EXISTS (SELECT 1 FROM fraud_flags f WHERE f.user_id = u.id);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Customers deleted (no other card, no login): %', n;

  -- Part B: the staff's sign-in accounts
  IF current_setting('dvote.delete_staff_logins') = 'yes' AND logins IS NOT NULL THEN
    DELETE FROM auth.users a
     WHERE a.id = ANY (logins)
       AND NOT EXISTS (SELECT 1 FROM staff_users s WHERE s.auth_user_id = a.id)
       AND NOT EXISTS (SELECT 1 FROM platform_admins p WHERE p.auth_user_id = a.id)
       AND NOT EXISTS (SELECT 1 FROM users u WHERE u.auth_user_id = a.id);
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'Staff sign-in accounts deleted: %', n;
  END IF;

  -- safety check: every remaining card still matches its ledger
  IF EXISTS (
    SELECT 1 FROM cards c
     WHERE c.balance <> coalesce((SELECT sum(delta) FROM point_events e WHERE e.card_id = c.id), 0)
  ) THEN
    RAISE EXCEPTION 'A card balance no longer matches the ledger. Nothing was deleted.';
  END IF;
END $$;

COMMIT;
