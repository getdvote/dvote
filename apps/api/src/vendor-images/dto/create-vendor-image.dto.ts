import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { IsUuid } from '../../common/uuid';
import { vendor_image_kind } from '../../generated/prisma/enums.js';

/** Text fields sent with the image (multipart/form-data). */
export class CreateVendorImageDto {
  @ApiProperty({ enum: vendor_image_kind, enumName: 'VendorImageKind' })
  @IsIn(Object.values(vendor_image_kind))
  kind: vendor_image_kind;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'branch_photo only. Required for vendor admins; branch managers default to their own branch.',
  })
  @IsOptional()
  @IsUuid()
  branchId?: string;
}
