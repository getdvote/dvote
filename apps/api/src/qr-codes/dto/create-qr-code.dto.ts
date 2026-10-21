import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, ValidateIf } from 'class-validator';
import { IsUuid } from '../../common/uuid';

/**
 * Collect QRs:
 * - master QR (no vendorId): works at any shop; the scanning staff's vendor gets the points.
 * - shop QR (vendorId, made on that shop's page in the app): works only at that vendor;
 *   any other vendor's staff get 403 vendor_mismatch, so points never land at the wrong shop.
 * Redeem QR (rewardId): spends points on that reward; it carries the reward's vendor, so only
 * that vendor's staff can confirm it.
 */
export class CreateQrCodeDto {
  @ApiProperty({
    enum: ['collect', 'redeem'],
    description: 'collect = earn points on a purchase; redeem = get a reward with points',
  })
  @IsIn(['collect', 'redeem'])
  purpose: 'collect' | 'redeem';

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'collect only. Shop QR: only this vendor can scan it. Omit for the master QR (any shop).',
  })
  @ValidateIf((o: CreateQrCodeDto) => o.purpose === 'collect')
  @IsOptional()
  @IsUuid()
  vendorId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'redeem only (required): the reward to get' })
  @ValidateIf((o: CreateQrCodeDto) => o.purpose === 'redeem')
  @IsUuid()
  rewardId?: string;
}
