import { IsUuid } from '../../common/uuid';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

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
      'Vendor QR (from a vendor page): only that vendor can scan it. Omit for the master QR (any vendor).',
  })
  @IsOptional()
  @IsUuid()
  vendorId?: string;
}
