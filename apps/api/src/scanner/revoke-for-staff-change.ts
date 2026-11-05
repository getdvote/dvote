import type { Prisma } from '../generated/prisma/client.js';

interface StaffAccess {
  status: string;
  role: string;
  branch_id: string | null;
}

/**
 * Ends a staff member's phone sessions and unused codes when their access changes. Call it in the
 * same transaction as the change. Reversing the change later never brings a phone back.
 */
export async function revokeForStaffChange(
  tx: Prisma.TransactionClient,
  staffId: string,
  before: StaffAccess,
  after: StaffAccess,
): Promise<void> {
  const reason =
    before.status !== after.status && after.status !== 'active'
      ? 'staff_disabled'
      : before.role !== after.role
        ? 'role_changed'
        : before.branch_id !== after.branch_id
          ? 'branch_changed'
          : null;
  if (!reason) return;
  await tx.scanner_pairings.updateMany({
    where: { staff_id: staffId, revoked_at: null },
    data: { revoked_at: new Date(), revoked_reason: reason },
  });
}
