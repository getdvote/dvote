import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { IsUuid } from '../../common/uuid';
import { vendor_image_kind } from '../../generated/prisma/enums.js';

export class ListVendorImagesQueryDto {
  @ApiPropertyOptional({ enum: vendor_image_kind, enumName: 'VendorImageKind' })
  @IsOptional()
  @IsIn(Object.values(vendor_image_kind))
  kind?: vendor_image_kind;

  @ApiPropertyOptional({ format: 'uuid', description: 'Only this branch’s photos' })
  @IsOptional()
  @IsUuid()
  branchId?: string;
}
