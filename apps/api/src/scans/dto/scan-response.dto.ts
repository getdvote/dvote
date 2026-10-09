import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { qr_purpose } from '../../generated/prisma/enums.js';

/**
 * A redeem QR's details for the staff confirmation screen: the reward, and the customer's name
 * and points at this shop (decided 2026-10-10: staff see who is redeeming, to hand the reward
 * to the right person). Only for a usable redeem QR of the staff's own vendor.
 */
export class PreviewRedeemDto {
  @ApiProperty({ format: 'uuid' }) rewardId: string;
  @ApiProperty({ example: 'Free coffee' }) rewardName: string;
  @ApiProperty({ type: String, nullable: true }) rewardNameAr: string | null;
  @ApiProperty({ type: String, nullable: true }) rewardDescription: string | null;
  @ApiProperty({ type: String, nullable: true }) rewardImageUrl: string | null;
  @ApiProperty({ example: 300 }) pointsCost: number;
  @ApiProperty({ type: String, nullable: true, example: 'Mona Ali', description: 'The customer (name from their profile; null if not set)' })
  customerName: string | null;
  @ApiProperty({ example: 1000, description: 'Customer points at this shop now' }) balance: number;
  @ApiProperty({ example: 700, description: 'Points left after this redemption' }) balanceAfter: number;
}

/** What the staff app shows right after scanning. Collect: no customer personal data. */
export class PreviewScanResponseDto {
  @ApiProperty({ enum: qr_purpose, enumName: 'QrPurpose' })
  purpose: qr_purpose;

  @ApiProperty({
    description: 'true = staff can go ahead (enter the receipt total)',
  })
  usable: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'qr_used',
    description:
      'Why not usable: qr_used | qr_expired | qr_cancelled | vendor_mismatch | user_blocked | no_active_rule (collect) | reward_unavailable | insufficient_points (redeem)',
  })
  reason: string | null;

  @ApiProperty()
  expiresAt: string;

  @ApiPropertyOptional({ type: PreviewRedeemDto, nullable: true, description: 'redeem QRs that can be confirmed' })
  redeem: PreviewRedeemDto | null;
}

/** A confirmed redemption: the reward was given and the points taken. */
export class RedeemResponseDto {
  @ApiProperty({ format: 'uuid' }) redemptionId: string;
  @ApiProperty({ format: 'uuid' }) pointEventId: string;
  @ApiProperty({ example: 'Free coffee' }) rewardName: string;
  @ApiProperty({ example: 300 }) pointsRedeemed: number;
  @ApiProperty({ example: 700, description: 'Customer points left at this shop' }) cardBalance: number;
  @ApiProperty({ format: 'uuid' }) branchId: string;
  @ApiProperty({ example: 'Joy Corner Smouha' }) branchName: string;
  @ApiProperty() at: string;
}

export class CollectResponseDto {
  @ApiProperty({ format: 'uuid' })
  pointEventId: string;

  @ApiProperty({ example: 9 })
  pointsAdded: number;

  @ApiProperty({ example: '95.50' })
  purchaseAmount: string;

  @ApiProperty({ example: 'EGP' })
  currency: string;

  @ApiProperty({ example: 1, description: 'Point rule version used' })
  ruleVersion: number;

  @ApiProperty({ format: 'uuid' })
  branchId: string;

  @ApiProperty({ example: 'Joy Corner Smouha' })
  branchName: string;

  @ApiProperty({ type: String, nullable: true })
  receiptRef: string | null;

  @ApiProperty()
  at: string;
}
