import { Body, Controller, Get, Injectable, Module, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AdminApi } from '../auth/admin-api.decorator';
import { AuthModule } from '../auth/auth.module';
import { CurrentAdmin } from '../auth/current-admin.decorator';
import type { AdminContext } from '../auth/platform-admin.guard';
import { IsUuid, ParseUuidPipe } from '../common/uuid';
import { Prisma, type fraud_flag_status, type fraud_flag_type } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { FRAUD_RULES, FraudCheckService, type FraudCheckResult } from './fraud-check.service';

const TYPES = ['too_many_collects', 'large_purchase', 'branch_spike', 'staff_spike'] as const;
const STATUSES = ['open', 'dismissed', 'confirmed'] as const;

export class ListFraudFlagsQueryDto {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: fraud_flag_status;

  @ApiPropertyOptional({ enum: TYPES })
  @IsOptional()
  @IsIn(TYPES)
  type?: fraud_flag_type;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUuid()
  vendorId?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class ReviewFraudFlagDto {
  @ApiProperty({ enum: STATUSES, description: 'confirmed = real problem; dismissed = false alarm; open = undo a review' })
  @IsIn(STATUSES)
  status: fraud_flag_status;

  @ApiPropertyOptional({ maxLength: 500, description: 'Why (kept with the flag)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class NamedDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
}
class FlagUserDto extends NamedDto {
  @ApiProperty({ type: String, nullable: true }) email: string | null;
  @ApiProperty({ enum: ['active', 'blocked'] }) status: string;
}

export class FraudFlagDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: TYPES }) type: fraud_flag_type;
  @ApiProperty({ enum: STATUSES }) status: fraud_flag_status;
  @ApiProperty({ type: NamedDto, nullable: true }) vendor: NamedDto | null;
  @ApiProperty({ type: NamedDto, nullable: true }) branch: NamedDto | null;
  @ApiProperty({ type: FlagUserDto, nullable: true, description: 'The customer (platform admins only)' }) user: FlagUserDto | null;
  @ApiProperty({ type: NamedDto, nullable: true }) staff: NamedDto | null;
  @ApiProperty({ description: 'What was found (day, counts, amounts, averages) and the review note' })
  details: Record<string, unknown>;
  @ApiProperty({ type: NamedDto, nullable: true, description: 'Platform admin who reviewed it' }) reviewedBy: NamedDto | null;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

export class FraudFlagListDto {
  @ApiProperty({ type: [FraudFlagDto] }) items: FraudFlagDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
}

export class FraudSummaryDto {
  @ApiProperty() open: number;
  @ApiProperty({ description: 'Open flags per type' }) openByType: Record<string, number>;
  @ApiProperty() confirmed: number;
  @ApiProperty() dismissed: number;
  @ApiProperty({ description: 'New flags in the last 7 days' }) last7d: number;
  @ApiProperty({ type: String, nullable: true, description: 'When the check last ran (since the API started)' }) lastCheckAt: string | null;
  @ApiProperty({ description: 'The thresholds in use' }) rules: Record<string, number>;
}

const withNames = {
  vendors: { select: { id: true, name: true } },
  branches: { select: { id: true, name: true } },
  users: { select: { id: true, name: true, email: true, status: true } },
  staff_users: { select: { id: true, name: true } },
  platform_admins: { select: { id: true, name: true } },
} satisfies Prisma.fraud_flagsInclude;
type FlagRow = Prisma.fraud_flagsGetPayload<{ include: typeof withNames }>;

const toDto = (f: FlagRow): FraudFlagDto => ({
  id: f.id,
  type: f.type,
  status: f.status,
  vendor: f.vendors,
  branch: f.branches,
  user: f.users ? { id: f.users.id, name: f.users.name ?? 'Customer', email: f.users.email, status: f.users.status } : null,
  staff: f.staff_users,
  details: (f.details ?? {}) as Record<string, unknown>,
  reviewedBy: f.platform_admins,
  createdAt: f.created_at.toISOString(),
  updatedAt: f.updated_at.toISOString(),
});

@Injectable()
export class FraudFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ListFraudFlagsQueryDto): Promise<FraudFlagListDto> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;
    const where: Prisma.fraud_flagsWhereInput = { status: q.status, type: q.type, vendor_id: q.vendorId };
    const [rows, total] = await Promise.all([
      this.prisma.fraud_flags.findMany({
        where,
        include: withNames,
        orderBy: [{ created_at: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.fraud_flags.count({ where }),
    ]);
    return { items: rows.map(toDto), total, page, pageSize };
  }

  async summary(lastCheckAt: string | null): Promise<FraudSummaryDto> {
    const [byStatus, openByType, last7d] = await Promise.all([
      this.prisma.fraud_flags.groupBy({ by: ['status'], _count: true }),
      this.prisma.fraud_flags.groupBy({ by: ['type'], where: { status: 'open' }, _count: true }),
      this.prisma.fraud_flags.count({ where: { created_at: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
    ]);
    const s = (st: fraud_flag_status) => byStatus.find((b) => b.status === st)?._count ?? 0;
    return {
      open: s('open'),
      openByType: Object.fromEntries(TYPES.map((t) => [t, openByType.find((o) => o.type === t)?._count ?? 0])),
      confirmed: s('confirmed'),
      dismissed: s('dismissed'),
      last7d,
      lastCheckAt,
      rules: { ...FRAUD_RULES },
    };
  }

  /** Confirm / dismiss (or reopen) a flag; who and when are kept, with the note, in details.review. */
  async review(id: string, adminId: string, dto: ReviewFraudFlagDto): Promise<FraudFlagDto> {
    const flag = await this.prisma.fraud_flags.findUnique({ where: { id } });
    if (!flag) throw new NotFoundException({ code: 'fraud_flag_not_found' });
    const details = { ...((flag.details ?? {}) as Record<string, unknown>) };
    if (dto.status === 'open') delete details.review;
    else details.review = { note: dto.note?.trim() || null, at: new Date().toISOString() };
    const updated = await this.prisma.fraud_flags.update({
      where: { id },
      data: {
        status: dto.status,
        reviewed_by: dto.status === 'open' ? null : adminId,
        details: details as Prisma.InputJsonValue,
      },
      include: withNames,
    });
    return toDto(updated);
  }
}

@AdminApi('admin: fraud & risk')
@Controller('admin/fraud')
export class AdminFraudController {
  constructor(
    private readonly flags: FraudFlagsService,
    private readonly check: FraudCheckService,
  ) {}

  /** Counts for the dashboard header + the thresholds in use. */
  @Get('summary')
  @ApiOkResponse({ type: FraudSummaryDto })
  summary(): Promise<FraudSummaryDto> {
    return this.flags.summary(this.check.last?.at ?? null);
  }

  /** Flags, newest first, filtered by status / type / vendor. */
  @Get('flags')
  @ApiOkResponse({ type: FraudFlagListDto })
  list(@Query() q: ListFraudFlagsQueryDto): Promise<FraudFlagListDto> {
    return this.flags.list(q);
  }

  /** Confirm (real problem) or dismiss (false alarm) a flag, with an optional note; status open undoes it. */
  @Patch('flags/:id')
  @ApiOkResponse({ type: FraudFlagDto })
  @ApiNotFoundResponse({ description: 'fraud_flag_not_found' })
  review(
    @CurrentAdmin() admin: AdminContext,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: ReviewFraudFlagDto,
  ): Promise<FraudFlagDto> {
    return this.flags.review(id, admin.adminId, dto);
  }

  /** Run the check now (it also runs every 15 minutes). Returns how many new flags it made. */
  @Post('check')
  @ApiOkResponse({ description: '{ at, created, byType }' })
  run(): Promise<FraudCheckResult> {
    return this.check.run();
  }
}

/** Fraud & risk monitoring: the scheduled check + admin review (/api/admin/fraud). */
@Module({
  imports: [AuthModule],
  controllers: [AdminFraudController],
  providers: [FraudFlagsService, FraudCheckService],
  exports: [FraudCheckService],
})
export class FraudFlagsModule {}
