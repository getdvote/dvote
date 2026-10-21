import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
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
} from 'class-validator';
import { CARD_DESIGN_COUNT, VENDOR_CATEGORIES, type VendorCategory } from '../vendor-branding';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateVendorDto {
  @ApiProperty({ maxLength: 120, example: 'Ecuador Coffee' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({
    maxLength: 500,
    example: 'https://cdn.example.com/ecuador.png',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  logoUrl?: string;

  @ApiPropertyOptional({ maxLength: 255, example: 'owner@ecuador.coffee' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string;

  @ApiPropertyOptional({
    default: 'EGP',
    example: 'EGP',
    description: 'ISO 4217 code of receipt totals and point rules',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsISO4217CurrencyCode()
  currency?: string;

  @ApiPropertyOptional({ enum: VENDOR_CATEGORIES, description: 'What kind of place it is' })
  @IsOptional()
  @IsIn(VENDOR_CATEGORIES)
  category?: VendorCategory;

  @ApiPropertyOptional({ minimum: 1, maximum: CARD_DESIGN_COUNT, description: 'Loyalty-card design 1-10' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(CARD_DESIGN_COUNT)
  cardDesign?: number;
}
