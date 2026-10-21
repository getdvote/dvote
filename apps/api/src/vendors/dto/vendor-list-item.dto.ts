import { ApiProperty } from '@nestjs/swagger';

export class VendorListRuleDto {
  @ApiProperty({ example: '10.00' })
  spendAmount: string;

  @ApiProperty({ example: 1 })
  pointsPerSpend: number;
}

/** One shop in the customer app's Explore list (details: GET /api/app/vendors/{id}). */
export class VendorListItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Joy Corner' })
  name: string;

  @ApiProperty({ type: String, nullable: true })
  logoUrl: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Shop-page banner' })
  bannerUrl: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'cafe | cafe_restaurant | restaurant | bakery | desserts | juice_bar' })
  category: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Loyalty-card design 1-10; null = automatic' })
  cardDesign: number | null;

  @ApiProperty({ example: 'EGP' })
  currency: string;

  @ApiProperty({ type: VendorListRuleDto, nullable: true, description: 'null = no active rule yet' })
  rule: VendorListRuleDto | null;

  @ApiProperty({ example: 3, description: 'Active rewards' })
  rewardsCount: number;

  @ApiProperty({ example: 2, description: 'Open branches' })
  branchesCount: number;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Smouha, Alexandria',
    description: 'Address of the first open branch, as a hint of where the shop is',
  })
  firstAddress: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 95, description: 'My points here (null = no card yet)' })
  myBalance: number | null;
}

/** A shop near the customer: the Explore card plus how far its closest open branch is. */
export class NearbyVendorDto extends VendorListItemDto {
  @ApiProperty({ example: 1.4, description: 'Km to the closest open branch (straight line)' })
  distanceKm: number;

  @ApiProperty({ example: 'Joy Corner Smouha', description: 'That closest branch' })
  nearestBranch: string;
}

export class NearbyVendorsResponseDto {
  @ApiProperty({ description: 'false = no location known yet (none sent, none saved)' })
  located: boolean;

  @ApiProperty({ type: [NearbyVendorDto], description: 'Nearest first' })
  items: NearbyVendorDto[];
}
