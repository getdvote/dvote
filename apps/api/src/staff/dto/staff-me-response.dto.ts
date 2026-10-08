import { ApiProperty } from '@nestjs/swagger';
import { StaffResponseDto } from './staff-response.dto';

export class StaffMeVendorDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Joy Corner' })
  name: string;

  @ApiProperty({ type: String, nullable: true })
  logoUrl: string | null;

  @ApiProperty({ example: 'EGP' })
  currency: string;
}

export class StaffMeBranchDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Joy Corner Smouha' })
  name: string;
}

/** The vendor's active earning rule, for the "Point = 10 EGP" line in the staff app. */
export class StaffMeRuleDto {
  @ApiProperty({ example: 1 })
  version: number;

  @ApiProperty({
    example: '10.00',
    description: 'Money spent per step (vendor currency)',
  })
  spendAmount: string;

  @ApiProperty({ example: 1, description: 'Points per step' })
  pointsPerSpend: number;

  @ApiProperty({
    example: '0.00',
    description: 'Smaller receipts earn nothing',
  })
  minPurchase: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Cap per receipt (null = none)',
  })
  maxPointsPerPurchase: number | null;
}

/**
 * Everything the staff app needs after sign-in, in one call: who I am, my vendor (name,
 * logo, currency), my branch, the branches I may scan at, and the active point rule.
 */
export class StaffMeResponseDto extends StaffResponseDto {
  @ApiProperty({ type: StaffMeVendorDto })
  vendor: StaffMeVendorDto;

  @ApiProperty({
    type: StaffMeBranchDto,
    nullable: true,
    description:
      'null for vendor_admin (they pick one of `branches` when scanning)',
  })
  branch: StaffMeBranchDto | null;

  @ApiProperty({
    type: [StaffMeBranchDto],
    description:
      'Active branches this person can scan at: their own branch, or all of the vendor (vendor_admin)',
  })
  branches: StaffMeBranchDto[];

  @ApiProperty({
    type: StaffMeRuleDto,
    nullable: true,
    description:
      'null = the vendor has no rule yet (collecting is refused: no_active_rule)',
  })
  activeRule: StaffMeRuleDto | null;
}
