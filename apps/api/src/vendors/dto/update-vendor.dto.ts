import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsISO4217CurrencyCode,
  Matches,
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

/** A stored vendor phone: +20 and an Egyptian mobile number (010/011/012/015 + 8 digits). */
const EGYPT_MOBILE = /^\+201[0125][0-9]{8}$/;

/**
 * "010 0123 4567", "+20 10 0123 4567", "00201001234567" → "+201001234567". Anything else is
 * returned without spaces/dashes so the validator rejects it.
 */
export function egyptianMobile(raw: string): string {
  const s = raw.replace(/[\s\-()]/g, '');
  const m = /^(?:\+20|0020|20)?0?(1[0125][0-9]{8})$/.exec(s);
  return m ? `+20${m[1]}` : s;
}

/**
 * Only sent fields change. logoUrl / contactEmail / contactPhone accept null to clear them;
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
    type: String,
    nullable: true,
    example: '010 0123 4567',
    description:
      'Egyptian mobile number: 01 + 9 digits (010/011/012/015); a +20 / 0020 prefix, spaces and dashes are accepted. Stored as +201XXXXXXXXX',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? egyptianMobile(value) : value))
  @Matches(EGYPT_MOBILE, { message: 'contactPhone must be an Egyptian mobile number, e.g. 010 0123 4567' })
  contactPhone?: string | null;

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
