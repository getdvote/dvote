import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { point_event_type } from '../../generated/prisma/enums.js';

export class CardVendorDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Joy Corner' })
  name: string;

  @ApiProperty({ type: String, nullable: true })
  logoUrl: string | null;

  @ApiProperty({ example: 'EGP' })
  currency: string;

  @ApiProperty({ type: Number, nullable: true, description: 'Loyalty-card design 1-10 chosen by the vendor; null = automatic' })
  cardDesign: number | null;
}

export class NextRewardDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Free coffee' })
  name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'قهوة مجانية',
    description: 'Arabic name (null = not translated; show the English one)',
  })
  nameAr: string | null;

  @ApiProperty({ example: 300 })
  pointsCost: number;

  @ApiProperty({ example: 171, description: 'Points still needed' })
  pointsNeeded: number;
}

/** One card = the customer's points at one vendor. */
export class CardResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: CardVendorDto })
  vendor: CardVendorDto;

  @ApiProperty({ example: 129 })
  balance: number;

  @ApiProperty({
    example: 429,
    description: 'Total ever earned; never decreases',
  })
  lifetimePoints: number;

  @ApiProperty({ description: 'Active rewards the balance already covers' })
  affordableRewards: number;

  @ApiPropertyOptional({
    type: NextRewardDto,
    nullable: true,
    description: 'Cheapest active reward not yet affordable (null if none)',
  })
  nextReward: NextRewardDto | null;

  @ApiProperty()
  lastActivityAt: string;

  @ApiProperty({ description: 'When the card was created: the first purchase at this vendor' })
  createdAt: string;
}

export class CardEventResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: point_event_type, enumName: 'PointEventType' })
  type: point_event_type;

  @ApiProperty({ example: 9, description: '+ earned, − redeemed or corrected' })
  delta: number;

  @ApiProperty({ type: String, nullable: true, example: '95.50' })
  purchaseAmount: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Joy Corner Smouha' })
  branchName: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Free coffee' })
  rewardName: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'قهوة مجانية',
    description: 'Arabic reward name (null = not translated; show the English one)',
  })
  rewardNameAr: string | null;

  @ApiProperty()
  createdAt: string;
}
