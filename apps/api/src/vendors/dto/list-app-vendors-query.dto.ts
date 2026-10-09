import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListAppVendorsQueryDto {
  @ApiPropertyOptional({ example: 'joy', description: 'Part of the shop name (case-insensitive)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;
}
