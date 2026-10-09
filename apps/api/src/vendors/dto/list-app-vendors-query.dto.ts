import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class ListAppVendorsQueryDto {
  @ApiPropertyOptional({
    example: 'joy',
    description: 'Matches the shop name, category (EN/AR), a branch name / city / address, or a reward name (EN/AR); case-insensitive',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;
}

/** Shops near me: the position now (lat + lng together), or omit both to use my last saved one. */
export class NearbyVendorsQueryDto {
  @ApiPropertyOptional({ example: 31.2156 })
  @ValidateIf((o: NearbyVendorsQueryDto) => o.lng !== undefined || o.lat !== undefined)
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: 29.9553 })
  @ValidateIf((o: NearbyVendorsQueryDto) => o.lat !== undefined || o.lng !== undefined)
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 30, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number;
}
