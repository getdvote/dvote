import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { IsUuid } from '../../common/uuid';

/**
 * Two kinds of collect QR:
 * - master QR (no vendorId): works at any shop; the scanning staff's vendor gets the points.
 * - shop QR (vendorId, made on that shop's page in the app): works only at that vendor;
 *   any other vendor's staff get 403 vendor_mismatch, so points never land at the wrong shop.
 */
export class CreateQrCodeDto {
  @ApiProperty({
    enum: ['collect'],
    description:
      'collect = earn points on a purchase (redeem comes with the redeem flow)',
  })
  @IsIn(['collect'])
  purpose: 'collect';

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Shop QR: only this vendor can scan it. Omit for the master QR (any shop).',
  })
  @IsOptional()
  @IsUuid()
  vendorId?: string;
}
