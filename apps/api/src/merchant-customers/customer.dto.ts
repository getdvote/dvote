import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsUuid } from '../common/uuid';

export const SEGMENTS = [
  'new',
  'returning',
  'regular',
  'at_risk',
  'no_visits',
] as const;
export type CustomerSegment = (typeof SEGMENTS)[number];
export const SORTS = ['recent', 'spend', 'visits', 'name'] as const;

export class CustomerScopeQuery {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Managers always use their own branch.',
  })
  @IsOptional()
  @IsUuid()
  branchId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page?: number;

  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class CustomerListQuery extends CustomerScopeQuery {
  @ApiPropertyOptional({
    description:
      'Display name or merchant card reference only; never contact details.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: SEGMENTS })
  @IsOptional()
  @IsIn(SEGMENTS)
  segment?: CustomerSegment;

  @ApiPropertyOptional({ enum: SORTS, default: 'recent' })
  @IsOptional()
  @IsIn(SORTS)
  sort?: (typeof SORTS)[number];
}

/** Allowlist: do not extend this with a users-row spread or contact fields. */
export class MerchantCustomerDto {
  @ApiProperty({
    description: 'Merchant-specific card ID, not the global user ID.',
  })
  id: string;
  @ApiProperty() reference: string;
  @ApiProperty({ type: String, nullable: true }) name: string | null;
  @ApiProperty({ enum: SEGMENTS }) segment: CustomerSegment;
  @ApiProperty({ type: String, nullable: true }) firstVisitAt: string | null;
  @ApiProperty({ type: String, nullable: true }) lastVisitAt: string | null;
  @ApiProperty() visits: number;
  @ApiProperty() visits90d: number;
  @ApiProperty({
    description:
      'Lifetime bills recorded through dvote in this scope, not total store sales.',
  })
  spend: string;
  @ApiProperty() averageBill: string;
  @ApiProperty() rewardsRedeemed: number;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Merchant-wide balance; omitted (null) in branch scope.',
  })
  pointsBalance: number | null;
}

export class CustomerSegmentCountDto {
  @ApiProperty({ enum: SEGMENTS }) key: CustomerSegment;
  @ApiProperty() count: number;
}

export class MerchantCustomerListDto {
  @ApiProperty({ type: [MerchantCustomerDto] }) items: MerchantCustomerDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty({
    description:
      'All customers in branch/merchant scope, before search and segment filters.',
  })
  customersTotal: number;
  @ApiProperty({ type: [CustomerSegmentCountDto] })
  segments: CustomerSegmentCountDto[];
  @ApiProperty({ description: 'Cairo calendar date used for classification.' })
  asOf: string;
}

export class CustomerEventDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: ['earn', 'redeem', 'adjust'] }) type:
    'earn' | 'redeem' | 'adjust';
  @ApiProperty() points: number;
  @ApiProperty({ type: String, nullable: true }) amount: string | null;
  @ApiProperty({ type: String, nullable: true }) branchName: string | null;
  @ApiProperty({ type: String, nullable: true }) rewardName: string | null;
  @ApiProperty() createdAt: string;
}

export class MerchantCustomerDetailDto {
  @ApiProperty({ type: MerchantCustomerDto }) customer: MerchantCustomerDto;
  @ApiProperty({ type: [CustomerEventDto] }) events: CustomerEventDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() asOf: string;
}
