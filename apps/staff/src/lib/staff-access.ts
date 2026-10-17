/** The staff app is for till operators; viewers use the read-only dashboard. */
export function canUseStaffApp(role: string): boolean {
  return role === 'vendor_admin' || role === 'branch_manager' || role === 'staff';
}
