-- "Viewer only" staff role: merchant-wide (no branch), read-only dashboard access.
-- The CHECK compares role as text: a new enum value can't be used in the transaction that adds it.
ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'viewer';

ALTER TABLE staff_users DROP CONSTRAINT IF EXISTS staff_role_branch_ck;
ALTER TABLE staff_users ADD CONSTRAINT staff_role_branch_ck CHECK (
    (role::text IN ('vendor_admin', 'viewer') AND branch_id IS NULL) OR
    (role::text NOT IN ('vendor_admin', 'viewer') AND branch_id IS NOT NULL)
);
