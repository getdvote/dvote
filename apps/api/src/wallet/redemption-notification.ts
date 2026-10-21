import type { Prisma } from '../generated/prisma/client.js';

/** Queue inside the redemption transaction; the Wallet worker sends after commit. */
export async function queueRedemptionNotification(
  tx: Prisma.TransactionClient,
  data: {
    redemptionId: string;
    cardId: string;
    vendorId: string;
    staffId: string | null;
    adminId?: string;
    rewardName: string;
    points: number;
    balance: number;
  },
) {
  const title = 'Reward redeemed successfully';
  const body = `You have redeemed your reward successfully: ${data.rewardName}. ${data.points} points used. Your balance is ${data.balance} points.`;
  const audience = JSON.stringify({
    type: 'redemption',
    redemptionId: data.redemptionId,
  });
  // Reuse the durable Wallet delivery outbox and its shared per-card daily quota.
  await tx.$executeRaw`
    WITH notification AS (
      INSERT INTO wallet_broadcasts(vendor_id,created_by,created_by_admin_id,title,body,audience,idempotency_key)
      SELECT c.vendor_id,${data.staffId}::uuid,${data.adminId ?? null}::uuid,${title},${body},${audience}::jsonb,${`redemption:${data.redemptionId}`}
      FROM cards c WHERE c.id=${data.cardId}::uuid AND c.vendor_id=${data.vendorId}::uuid AND c.google_object_id IS NOT NULL
      ON CONFLICT(vendor_id,idempotency_key) DO NOTHING RETURNING id,vendor_id
    )
    INSERT INTO wallet_broadcast_recipients(broadcast_id,vendor_id,card_id,google_object_id)
    SELECT n.id,n.vendor_id,c.id,c.google_object_id FROM notification n
    JOIN cards c ON c.id=${data.cardId}::uuid AND c.vendor_id=n.vendor_id`;
}
