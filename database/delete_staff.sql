-- =====================================================================
-- dvote: DELETE ONE STAFF MEMBER (staff_users row)
-- =====================================================================
-- Deletes the staff member and cleans up everything that points at them:
--   - things they created (point rules, customer segments, sold-out marks,
--     wallet messages, manual segment changes): kept, without their name;
--   - fraud flags only about them, and their feedback to dvote: deleted.
--
-- Their SCAN HISTORY (points collected, rewards given, QR codes used) must
-- name a staff member; the database requires it and the ledger can't change
-- its numbers. So:
--   - no scans  → deleted completely;
--   - has scans → refused, unless you give another staff member of the SAME
--     shop below: their history is then moved to that person. Customers'
--     points do not change. (Usually better: just disable them in
--     Settings → Team.)
--
-- How to run (Supabase dashboard → SQL Editor), all in ONE run:
--   1. Paste this whole file.
--   2. Fill in the staff id AND their exact email (both must match).
--   3. Run. Any problem → everything is rolled back, nothing deleted.
-- Find the id:  SELECT id, name, email, role, vendor_id FROM staff_users ORDER BY name;
-- =====================================================================

BEGIN;

SET LOCAL dvote.staff_id    = '00000000-0000-0000-0000-000000000000';  -- ← the staff id
SET LOCAL dvote.staff_email = '';                                      -- ← their exact email

-- Only if they have scans: another staff member of the same shop to take over their history.
SET LOCAL dvote.history_to_staff_id = '';                              -- ← e.g. the shop's admin id, or leave ''

-- Also delete their sign-in account (only if no other staff row, admin or customer uses it): 'yes' / 'no'
SET LOCAL dvote.delete_login = 'no';

DO $$
DECLARE
  s       staff_users%ROWTYPE;
  heir    staff_users%ROWTYPE;
  heir_id text := nullif(current_setting('dvote.history_to_staff_id'), '');
  scans   bigint;
  n       bigint;
BEGIN
  SELECT * INTO s FROM staff_users WHERE id = current_setting('dvote.staff_id')::uuid;
  IF s.id IS NULL THEN
    RAISE EXCEPTION 'No staff member with id %. Nothing was deleted.', current_setting('dvote.staff_id');
  END IF;
  IF lower(s.email) IS DISTINCT FROM lower(current_setting('dvote.staff_email')) THEN
    RAISE EXCEPTION 'Email does not match: staff % is %. Nothing was deleted.', s.id, s.email;
  END IF;
  RAISE NOTICE 'Deleting staff "%" <%> (role %)', s.name, s.email, s.role;

  SELECT (SELECT count(*) FROM point_events WHERE staff_id = s.id)
       + (SELECT count(*) FROM redemptions  WHERE staff_id = s.id)
       + (SELECT count(*) FROM qr_codes     WHERE used_by_staff_id = s.id)
    INTO scans;

  IF scans > 0 THEN
    IF heir_id IS NULL THEN
      RAISE EXCEPTION 'This staff member has % scan record(s). Disable them in Settings → Team instead, or set dvote.history_to_staff_id to another staff member of the same shop. Nothing was deleted.', scans;
    END IF;
    SELECT * INTO heir FROM staff_users WHERE id = heir_id::uuid;
    IF heir.id IS NULL OR heir.id = s.id OR heir.vendor_id <> s.vendor_id THEN
      RAISE EXCEPTION 'history_to_staff_id must be another staff member of the same shop. Nothing was deleted.';
    END IF;
    RAISE NOTICE 'Moving % scan record(s) to "%" <%>', scans, heir.name, heir.email;

    -- the ledger refuses UPDATE by design: allow it for this transaction only (numbers are not touched)
    ALTER TABLE point_events DISABLE TRIGGER point_events_no_update;
    UPDATE point_events SET staff_id = heir.id WHERE staff_id = s.id;
    ALTER TABLE point_events ENABLE TRIGGER point_events_no_update;
    UPDATE redemptions SET staff_id = heir.id WHERE staff_id = s.id;
    UPDATE qr_codes    SET used_by_staff_id = heir.id WHERE used_by_staff_id = s.id;
  END IF;

  -- things they created stay, without their name
  UPDATE point_rules              SET created_by_staff_id = NULL WHERE created_by_staff_id = s.id;
  UPDATE reward_sold_outs         SET set_by_staff_id     = NULL WHERE set_by_staff_id     = s.id;
  IF to_regclass('public.customer_segments') IS NOT NULL THEN
    UPDATE customer_segments        SET created_by_staff_id = NULL WHERE created_by_staff_id = s.id;
    UPDATE customer_segment_members SET set_by_staff_id     = NULL WHERE set_by_staff_id     = s.id;
  END IF;
  IF to_regclass('public.wallet_broadcasts') IS NOT NULL THEN
    UPDATE wallet_broadcasts SET created_by = NULL WHERE created_by = s.id;
  END IF;

  -- fraud flags: only about this staff member → delete; also about something else → drop the staff part
  DELETE FROM fraud_flags WHERE staff_id = s.id AND num_nonnulls(vendor_id, branch_id, user_id) = 0;
  UPDATE fraud_flags SET staff_id = NULL WHERE staff_id = s.id;

  -- their feedback to dvote (the Get help dialog)
  IF to_regclass('public.merchant_feedback') IS NOT NULL THEN
    DELETE FROM merchant_feedback WHERE staff_id = s.id;
  END IF;

  DELETE FROM staff_users WHERE id = s.id;

  -- the sign-in account
  IF current_setting('dvote.delete_login') = 'yes' AND s.auth_user_id IS NOT NULL THEN
    DELETE FROM auth.users a
     WHERE a.id = s.auth_user_id
       AND NOT EXISTS (SELECT 1 FROM staff_users x     WHERE x.auth_user_id = a.id)
       AND NOT EXISTS (SELECT 1 FROM platform_admins p WHERE p.auth_user_id = a.id)
       AND NOT EXISTS (SELECT 1 FROM users u           WHERE u.auth_user_id = a.id);
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'Sign-in account deleted: %', n;
  END IF;

  RAISE NOTICE 'Done.';
END $$;

COMMIT;
