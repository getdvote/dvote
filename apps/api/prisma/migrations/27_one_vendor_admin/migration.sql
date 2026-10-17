-- Disabled accounts still own the admin role: re-enable or explicitly transfer it.
CREATE UNIQUE INDEX staff_users_one_admin_uq ON staff_users (vendor_id)
WHERE role = 'vendor_admin';
