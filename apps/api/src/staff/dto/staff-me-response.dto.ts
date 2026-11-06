import { ApiProperty } from '@nestjs/swagger';
import { StaffResponseDto } from './staff-response.dto';
import type { Entitlements } from '../../plans/entitlements';

/** The shop's plan: a self sign-up is on a free trial until an admin activates a plan. */
export class StaffMePlanDto {
  @ApiProperty({ enum: ['trial', 'active'] })
  status: 'trial' | 'active';

  @ApiProperty({ type: String, nullable: true, enum: ['regular', 'loyal', 'chain'] })
  plan: string | null;

  @ApiProperty({ type: String, nullable: true, enum: ['monthly', 'annual'] })
  billingCycle: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Paid until (then 7 days of grace, then locked); null = no end' })
  paidUntil: string | null;

  @ApiProperty({ description: 'What the plan includes: {tier, trial, features, limits} (plans/entitlements.ts)' })
  entitlements: Entitlements;

  @ApiProperty({ type: String, nullable: true, description: 'When the free trial ends (trial only)' })
  trialEndsAt: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'When an unpaid trial shop is deleted for good (trial only)' })
  deleteAt: string | null;
}

export class StaffMeVendorDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Joy Corner' })
  name: string;

  @ApiProperty({ type: String, nullable: true })
  logoUrl: string | null;

  @ApiProperty({ example: 'EGP' })
  currency: string;

  @ApiProperty({ type: StaffMePlanDto })
  plan: StaffMePlanDto;
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
