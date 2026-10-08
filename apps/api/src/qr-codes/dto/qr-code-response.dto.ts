import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { qr_purpose, qr_status } from '../../generated/prisma/enums.js';

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
      'Always null for collect QRs (the scanning staff decide the vendor); a redeem QR will carry its reward vendor',
  })
  vendorId: string | null;

  @ApiProperty()
  expiresAt: string;
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
}
