import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { vendor_status } from '../../generated/prisma/enums.js';

export class ListVendorsQueryDto {
  @ApiPropertyOptional({ enum: vendor_status, enumName: 'VendorStatus' })
  @IsOptional()
  @IsEnum(vendor_status)
  status?: vendor_status;

  @ApiPropertyOptional({ description: 'Part of the name, any case' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  search?: string;
}
