import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { qr_purpose } from '../../generated/prisma/enums.js';

/** What the staff app shows right after scanning. No customer personal data. */
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
      'Why not usable: qr_used | qr_expired | qr_cancelled | vendor_mismatch | user_blocked',
  })
  reason: string | null;

  @ApiProperty({ description: 'false = master QR (any vendor)' })
  vendorQr: boolean;

  @ApiProperty()
  expiresAt: string;
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
