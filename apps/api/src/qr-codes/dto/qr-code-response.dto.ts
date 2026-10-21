import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { qr_purpose, qr_status } from '../../generated/prisma/enums.js';

/** The reward a redeem QR is for (shown above the QR). */
export class QrRewardDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Free coffee' }) name: string;
  @ApiProperty({ type: String, nullable: true }) nameAr: string | null;
  @ApiProperty({ example: 300 }) pointsCost: number;
  @ApiProperty({ type: String, nullable: true }) imageUrl: string | null;
  @ApiProperty({ example: 'Joy Corner' }) vendorName: string;
}

/** Returned once, when the QR is created: `code` is what the app draws as a QR. */
export class CreateQrCodeResponseDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Poll GET /api/app/qr-codes/{id}',
  })
  id: string;

  @ApiProperty({
    example: 'dvote:q1:Zx3kq0T7bQ8m2Lr9vPa1Yw',
    description: 'Show this as the QR. Never stored by the server; single use.',
  })
  code: string;

  @ApiProperty({ enum: qr_purpose, enumName: 'QrPurpose' })
  purpose: qr_purpose;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'null for the master collect QR; the shop for a shop collect QR; the reward vendor for a redeem QR',
  })
  vendorId: string | null;

  @ApiProperty()
  expiresAt: string;

  @ApiPropertyOptional({ type: QrRewardDto, nullable: true, description: 'redeem QRs: the reward' })
  reward: QrRewardDto | null;
}

/** What happened when staff confirmed a redeem QR. */
export class QrRedeemResultDto {
  @ApiProperty({ example: 'Free coffee', description: 'Reward name when it was given (snapshot)' }) rewardName: string;
  @ApiProperty({ type: String, nullable: true }) rewardNameAr: string | null;
  @ApiProperty({ example: 300, description: 'Points taken from the card' }) pointsRedeemed: number;
  @ApiProperty({ format: 'uuid' }) vendorId: string;
  @ApiProperty({ example: 'Joy Corner' }) vendorName: string;
  @ApiProperty({ example: 'Joy Corner Smouha' }) branchName: string;
  @ApiProperty({ format: 'uuid' }) cardId: string;
  @ApiProperty({ example: 700, description: 'Card balance now' }) cardBalance: number;
  @ApiProperty() at: string;
}

/** What happened when a staff member used the QR (collect). */
export class QrCollectResultDto {
  @ApiProperty({ example: 9 })
  pointsAdded: number;

  @ApiProperty({
    example: '95.00',
    description: 'Receipt total, exact decimal string',
  })
  purchaseAmount: string;

  @ApiProperty({ example: 'EGP' })
  currency: string;

  @ApiProperty({ format: 'uuid' })
  vendorId: string;

  @ApiProperty({ example: 'Joy Corner' })
  vendorName: string;

  @ApiProperty({ example: 'Joy Corner Smouha' })
  branchName: string;

  @ApiProperty({ format: 'uuid' })
  cardId: string;

  @ApiProperty({ example: 129, description: 'Card balance now' })
  cardBalance: number;

  @ApiProperty()
  at: string;
}

export class QrCodeStatusResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: qr_purpose, enumName: 'QrPurpose' })
  purpose: qr_purpose;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  vendorId: string | null;

  @ApiProperty({
    enum: qr_status,
    enumName: 'QrStatus',
    description: 'active = still waiting to be scanned',
  })
  status: qr_status;

  @ApiProperty()
  expiresAt: string;

  @ApiPropertyOptional({ type: QrCollectResultDto, nullable: true })
  result: QrCollectResultDto | null;

  @ApiPropertyOptional({ type: QrRedeemResultDto, nullable: true, description: 'redeem QRs, once confirmed' })
  redeemResult: QrRedeemResultDto | null;
}
