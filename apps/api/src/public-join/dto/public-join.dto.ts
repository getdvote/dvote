import type { Storefront } from '../../storefront/storefront';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsUuid } from '../../common/uuid';

export const JOIN_SOURCES = ['nfc', 'qr', 'link'] as const;
export const HEARD_FROM = ['friend', 'social_media', 'walking_by', 'google_maps', 'other'] as const;

export class JoinVendorDto {
  @ApiProperty({ example: 'Mona Ali', description: 'With the phone, identifies the customer: a known phone needs the same name (409 details_mismatch)' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({
    example: '01001234567',
    description: 'Egyptian mobile (010/011/012/015); any common format. The customer key (one customer per mobile)',
  })
  @IsString()
  @MaxLength(20)
  phone: string;

  @ApiPropertyOptional({ example: 'mona@gmail.com', description: 'Optional (the form no longer asks, decided 2026-10-17); saved for a new customer' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: true, description: '"I\'m 14 or older" (the form no longer asks); saved when sent' })
  @IsOptional()
  @IsBoolean()
  ageConfirmed?: boolean;

  @ApiPropertyOptional({ enum: HEARD_FROM })
  @IsOptional()
  @IsIn(HEARD_FROM)
  heardFrom?: (typeof HEARD_FROM)[number];

  @ApiPropertyOptional({ description: 'Branch of the NFC tag / QR (from ?b= in the link)' })
  @IsOptional()
  @IsUuid()
  branchId?: string;

  @ApiProperty({ enum: JOIN_SOURCES, description: 'How the page was opened' })
  @IsIn(JOIN_SOURCES)
  source: (typeof JOIN_SOURCES)[number];
}

class PublicRuleDto {
  @ApiProperty({ example: '10.00' }) spendAmount: string;
  @ApiProperty({ example: 1 }) pointsPerSpend: number;
}

class PublicRewardDto {
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) nameAr: string | null;
  @ApiProperty() pointsCost: number;
  @ApiProperty({ type: String, nullable: true }) imageUrl: string | null;
}

class PublicBranchDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true, description: 'Street line' }) address: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Google Maps directions link, when the branch has a map pin' }) mapsUrl: string | null;
}

/** How the page looks (Settings → Branding). Colours are #rrggbb or null (= the card colours). */
class PublicStyleDto {
  @ApiProperty({ enum: ['spotlight', 'compact', 'branded', 'playful', 'split'] }) pageStyle: 'spotlight' | 'compact' | 'branded' | 'playful' | 'split';
  @ApiProperty({ type: String, nullable: true }) primary: string | null;
  @ApiProperty({ type: String, nullable: true }) secondary: string | null;
  @ApiProperty({ type: String, nullable: true, example: 'Playfair Display', description: 'Google Fonts family; null = default' }) font: string | null;
}

/** What the venue page and the join form show about a merchant (no private data). */
export class PublicVendorDto {
  @ApiProperty({ format: 'uuid', description: 'Picks the automatic card colours when cardDesign is null' }) id: string;
  @ApiProperty({ example: 'joy-corner' }) slug: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) logoUrl: string | null;
  @ApiProperty({ type: String, nullable: true }) bannerUrl: string | null;
  @ApiProperty({ type: String, nullable: true }) category: string | null;
  @ApiProperty({ type: Number, nullable: true, description: 'Loyalty-card design 1-10, null = automatic' }) cardDesign: number | null;
  @ApiProperty({ example: 'EGP' }) currency: string;
  @ApiProperty({ type: PublicRuleDto, nullable: true, description: 'null = not earning yet' }) rule: PublicRuleDto | null;
  @ApiProperty({ type: [PublicRewardDto] }) rewards: PublicRewardDto[];
  @ApiProperty({ type: [PublicBranchDto] }) branches: PublicBranchDto[];
  @ApiProperty({ type: PublicStyleDto }) style: PublicStyleDto;
  @ApiProperty({ description: 'Page sections in order ({type, ...}); the branch copy when ?b= names a branch that has one' }) sections: Storefront['sections'];
  @ApiProperty({ type: [String], description: 'Menu page images, in order' }) menu: string[];
}

/** One customer's loyalty card at one merchant, as the card page and the wallet pass show it. */
export class PublicCardDto {
  @ApiProperty({ description: 'Unguessable id: the card page is dvote.app/c/<publicId>' }) publicId: string;
  @ApiProperty({ example: 'CZW-QNM' }) shortCode: string;
  @ApiProperty({ example: 'Mona Ali' }) cardholder: string;
  @ApiProperty() balance: number;
  @ApiProperty({ type: PublicVendorDto }) vendor: Pick<PublicVendorDto, 'id' | 'slug' | 'name' | 'logoUrl' | 'bannerUrl' | 'cardDesign' | 'currency'>;
  @ApiProperty() createdAt: string;
}

export class JoinResultDto {
  @ApiProperty({ description: 'false = the customer already had a card here (sign in again = get it back)' }) created: boolean;
  @ApiProperty({ type: PublicCardDto }) card: PublicCardDto;
}
