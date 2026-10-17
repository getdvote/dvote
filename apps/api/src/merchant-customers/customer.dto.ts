import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsUuid } from '../common/uuid';
import {
  MAX_RULES,
  RULE_FIELDS,
  RULE_OPS,
  SEGMENTS,
  type CustomerSegment,
  type RuleField,
  type RuleOp,
} from './segments';

export { SEGMENTS, type CustomerSegment } from './segments';

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

  @ApiPropertyOptional({ format: 'uuid', description: 'Only customers whose custom segment is this one' })
  @IsOptional()
  @IsUuid()
  customSegment?: string;

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
  @ApiProperty({
    type: () => CustomerCustomSegmentDto,
    nullable: true,
    description: 'At most one: a hand-added segment wins, then the first one whose rules match',
  })
  customSegment: CustomerCustomSegmentDto | null;
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

export class CustomerCustomSegmentDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ description: 'true = added by hand, false = by the rules' }) manual: boolean;
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
  @ApiProperty({ type: () => [CustomSegmentDto], description: 'Active custom segments in list order, with counts in this scope' })
  customSegments: CustomSegmentDto[];
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

/** The profile adds the phone number (decided 2026-10-17: merchants may see it; email stays out). */
export class MerchantCustomerProfileDto extends MerchantCustomerDto {
  @ApiProperty({ type: String, nullable: true }) phone: string | null;
}

export class MerchantCustomerDetailDto {
  @ApiProperty({ type: MerchantCustomerProfileDto }) customer: MerchantCustomerProfileDto;
  @ApiProperty({ type: [CustomerEventDto] }) events: CustomerEventDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() asOf: string;
}

// ── Custom segments ────────────────────────────────────────────────────

export class SegmentRuleDto {
  @ApiProperty({ enum: Object.keys(RULE_FIELDS) })
  @IsIn(Object.keys(RULE_FIELDS))
  field: RuleField;

  @ApiProperty({ enum: RULE_OPS, description: 'gte / lte / eq for numbers, is / is_not for segment' })
  @IsIn(RULE_OPS)
  op: RuleOp;

  @ApiProperty({ oneOf: [{ type: 'number' }, { type: 'string' }], description: 'A number, or a built-in segment key' })
  @IsDefined()
  value: number | string;
}

export class CreateCustomerSegmentDto {
  @ApiProperty({ maxLength: 60 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 300 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value))
  @IsString()
  @MaxLength(300)
  description?: string | null;

  @ApiPropertyOptional({ enum: ['all', 'any'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'any'])
  match?: 'all' | 'any';

  @ApiPropertyOptional({ type: [SegmentRuleDto], description: `Up to ${MAX_RULES}; none = add customers by hand only` })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_RULES)
  @ValidateNested({ each: true })
  @Type(() => SegmentRuleDto)
  rules?: SegmentRuleDto[];
}

export class UpdateCustomerSegmentDto extends CreateCustomerSegmentDto {
  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  declare name: string;

  @ApiPropertyOptional({ description: 'Position in the list (lower first = wins when several match)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder?: number;
}

export class SegmentPreviewDto {
  @ApiPropertyOptional({ enum: ['all', 'any'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'any'])
  match?: 'all' | 'any';

  @ApiProperty({ type: [SegmentRuleDto] })
  @IsArray()
  @ArrayMaxSize(MAX_RULES)
  @ValidateNested({ each: true })
  @Type(() => SegmentRuleDto)
  rules: SegmentRuleDto[];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUuid()
  branchId?: string;
}

export class CustomSegmentDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) description: string | null;
  @ApiProperty({ enum: ['all', 'any'] }) match: 'all' | 'any';
  @ApiProperty({ type: [SegmentRuleDto] }) rules: SegmentRuleDto[];
  @ApiProperty() sortOrder: number;
  @ApiProperty({ description: 'Customers showing this segment, in the requested scope' }) count: number;
}

export class SegmentPreviewResultDto {
  @ApiProperty({ description: 'Customers matching the rules now (before hand-made changes)' }) count: number;
  @ApiProperty() customersTotal: number;
}

/** Export rows: the list fields plus contact details (merchant admins only). */
export class CustomerExportRowDto extends MerchantCustomerDto {
  @ApiProperty({ type: String, nullable: true }) email: string | null;
  @ApiProperty({ type: String, nullable: true }) phone: string | null;
  @ApiProperty() joinedAt: string;
}

export class CustomerExportDto {
  @ApiProperty({ type: [CustomerExportRowDto] }) items: CustomerExportRowDto[];
  @ApiProperty({ description: 'true when the export stopped at the row limit' }) truncated: boolean;
  @ApiProperty() asOf: string;
}
