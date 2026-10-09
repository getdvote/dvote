import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsISO4217CurrencyCode,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { vendor_status } from '../../generated/prisma/enums.js';
import { CARD_DESIGN_COUNT, VENDOR_CATEGORIES, type VendorCategory } from '../vendor-branding';

/**
 * Only sent fields change. logoUrl / contactEmail accept null to clear them;
 * name, currency and status can't be null.
 */
export class UpdateVendorDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @ValidateIf((o: UpdateVendorDto) => o.name !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  logoUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 255 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string | null;

  @ApiPropertyOptional({
    example: 'EGP',
    description: 'Locked once the vendor has a point rule (currency_locked)',
  })
  @ValidateIf((o: UpdateVendorDto) => o.currency !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsISO4217CurrencyCode()
  currency?: string;

  @ApiPropertyOptional({
    enum: vendor_status,
    enumName: 'VendorStatus',
    description:
      'suspended = soft delete: hidden from customers, staff blocked, no collecting or redeeming',
  })
  @ValidateIf((o: UpdateVendorDto) => o.status !== undefined)
  @IsEnum(vendor_status)
  status?: vendor_status;

  @ApiPropertyOptional({
    enum: VENDOR_CATEGORIES,
    nullable: true,
    description: 'What kind of place it is; null clears it',
  })
  @IsOptional()
  @IsIn(VENDOR_CATEGORIES)
  category?: VendorCategory | null;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: CARD_DESIGN_COUNT,
    nullable: true,
    description: 'Loyalty-card design 1-10 for this vendor’s cards; null = automatic',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(CARD_DESIGN_COUNT)
  cardDesign?: number | null;
}
