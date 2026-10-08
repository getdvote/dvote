import { ApiProperty } from '@nestjs/swagger';

export class VendorPageRuleDto {
  @ApiProperty({ example: '10.00', description: 'Spend this much (vendor currency)…' })
  spendAmount: string;

  @ApiProperty({ example: 1, description: '…to earn this many points (rounded down)' })
  pointsPerSpend: number;

  @ApiProperty({ example: '0.00', description: 'Bills below this earn nothing' })
  minPurchase: string;

  @ApiProperty({ type: Number, nullable: true, example: null, description: 'Cap per purchase' })
  maxPointsPerPurchase: number | null;
}

export class VendorPageRewardDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Free coffee' })
  name: string;

  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'قهوة مجانية',
    description: 'Arabic name (null = not translated; show the English one)',
  })
  nameAr: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'أي قهوة، أي حجم',
    description: 'Arabic description (null = not translated; show the English one)',
  })
  descriptionAr: string | null;

  @ApiProperty({ type: String, nullable: true })
  imageUrl: string | null;

  @ApiProperty({ example: 300 })
  pointsCost: number;
}

export class VendorPageImageDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Public link to the WebP image' })
  url: string;
}

export class VendorPageBranchDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Joy Corner Smouha' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: '14 Victor Emmanuel St, Smouha, Alexandria' })
  address: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 31.2156 })
  lat: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 29.9553 })
  lng: number | null;

  @ApiProperty({ type: [VendorPageImageDto] })
  photos: VendorPageImageDto[];
}

export class VendorPageCardDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 95 })
  balance: number;

  @ApiProperty({ example: 120 })
  lifetimePoints: number;
}

/** Everything the customer app's shop page shows. */
export class VendorPageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Joy Corner' })
  name: string;

  @ApiProperty({ type: String, nullable: true })
  logoUrl: string | null;

  @ApiProperty({ example: 'EGP' })
  currency: string;

  @ApiProperty({ type: VendorPageRuleDto, nullable: true, description: 'null = the shop has no active rule yet' })
  rule: VendorPageRuleDto | null;

  @ApiProperty({ type: [VendorPageRewardDto], description: 'Active rewards, in the shop’s order' })
  rewards: VendorPageRewardDto[];

  @ApiProperty({ type: [VendorPageImageDto], description: 'Menu pages, in order' })
  menu: VendorPageImageDto[];

  @ApiProperty({ type: [VendorPageBranchDto], description: 'Open branches' })
  branches: VendorPageBranchDto[];

  @ApiProperty({ type: VendorPageCardDto, nullable: true, description: 'My card at this shop (null before my first purchase)' })
  card: VendorPageCardDto | null;
}
