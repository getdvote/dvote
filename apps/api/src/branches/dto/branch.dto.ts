import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import type { branches } from '../../generated/prisma/client.js';
import { branch_status } from '../../generated/prisma/enums.js';
import { CITY_KEYS, type CityKey } from '../cities';

/** "HH:MM", 24-hour. */
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateBranchDto {
  @ApiProperty({ maxLength: 120, example: 'Joy Corner Smouha' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ maxLength: 500, example: '14 Victor Emmanuel St, Smouha, Alexandria', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @ApiPropertyOptional({ enum: CITY_KEYS, enumName: 'City', nullable: true, example: 'alexandria' })
  @IsOptional()
  @IsIn(CITY_KEYS)
  city?: CityKey | null;

  @ApiPropertyOptional({ example: 31.2156, nullable: true, description: 'Map location (for "Get directions")' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  lat?: number | null;

  @ApiPropertyOptional({ example: 29.9553, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  lng?: number | null;

  @ApiPropertyOptional({ maxLength: 64, example: 'Africa/Cairo', default: 'Africa/Cairo' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({
    example: '09:00',
    nullable: true,
    description: 'Opening time, "HH:MM" 24-hour, the same every day (branch timezone). Set with closesAt, or both null.',
  })
  @IsOptional()
  @Matches(CLOCK, { message: 'opensAt must be HH:MM' })
  opensAt?: string | null;

  @ApiPropertyOptional({ example: '23:00', nullable: true, description: 'Closing time; earlier than opensAt = open past midnight.' })
  @IsOptional()
  @Matches(CLOCK, { message: 'closesAt must be HH:MM' })
  closesAt?: string | null;
}

/** Only sent fields change; address/city/lat/lng/opensAt/closesAt accept null to clear. status=closed hides the branch (never deleted). */
export class UpdateBranchDto extends PartialType(CreateBranchDto) {
  @ApiPropertyOptional({ enum: branch_status, enumName: 'BranchStatus' })
  @IsOptional()
  @IsIn(Object.values(branch_status))
  status?: branch_status;
}

export class BranchResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  vendorId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  address: string | null;

  @ApiProperty({ enum: CITY_KEYS, enumName: 'City', nullable: true })
  city: string | null;

  @ApiProperty({ type: Number, nullable: true })
  lat: number | null;

  @ApiProperty({ type: Number, nullable: true })
  lng: number | null;

  @ApiProperty({ example: 'Africa/Cairo' })
  timezone: string;

  @ApiProperty({ type: String, nullable: true, example: '09:00' })
  opensAt: string | null;

  @ApiProperty({ type: String, nullable: true, example: '23:00' })
  closesAt: string | null;

  @ApiProperty({ enum: branch_status, enumName: 'BranchStatus' })
  status: branch_status;

  @ApiProperty()
  createdAt: string;

  static from(b: branches): BranchResponseDto {
    return {
      id: b.id,
      vendorId: b.vendor_id,
      name: b.name,
      address: b.address,
      city: b.city,
      lat: b.lat === null ? null : Number(b.lat),
      lng: b.lng === null ? null : Number(b.lng),
      timezone: b.timezone,
      opensAt: b.opens_at,
      closesAt: b.closes_at,
      status: b.status,
      createdAt: b.created_at.toISOString(),
    };
  }
}
