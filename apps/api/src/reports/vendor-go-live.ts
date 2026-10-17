import { Controller, Get, Injectable } from '@nestjs/common';
import { ApiOkResponse, ApiProperty } from '@nestjs/swagger';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffRoles, type StaffContext } from '../auth/staff-auth.guard';
import { VendorApi } from '../auth/vendor-api.decorator';
import { openingHoursEnabled, readWeek } from '../branches/hours';
import { PrismaService } from '../prisma/prisma.service';

/** The go-live steps, in the order a new merchant should do them. */
export const GO_LIVE_STEPS = [
  'logo',
  'banner',
  'rule',
  'reward',
  'branch_hours',
  'staff',
  'test_scan',
] as const;
export type GoLiveStep = (typeof GO_LIVE_STEPS)[number];

/** Where in the dashboard each step is done. */
const STEP_PATH: Record<GoLiveStep, string> = {
  logo: '/storefront',
  banner: '/storefront',
  rule: '/card',
  reward: '/rewards',
  branch_hours: '/branches',
  staff: '/staff',
  test_scan: '/activity',
};

class GoLiveRewardDto {
  @ApiProperty({
    description: 'Active rewards (any photo / Arabic name)',
  })
  active: number;
  @ApiProperty({ description: 'Active rewards that have a photo' })
  withPhoto: number;
  @ApiProperty({ description: 'Active rewards that have an Arabic name' })
  withArabic: number;
}

class GoLiveStepDto {
  @ApiProperty({ enum: GO_LIVE_STEPS, enumName: 'GoLiveStep' })
  key: GoLiveStep;
  @ApiProperty() done: boolean;
  @ApiProperty({ example: '/storefront', description: 'Dashboard path' })
  to: string;
}

export class VendorGoLiveDto {
  @ApiProperty({
    type: [GoLiveStepDto],
    description: 'In the order to do them',
  })
  steps: GoLiveStepDto[];
  @ApiProperty() done: number;
  @ApiProperty() total: number;
  @ApiProperty({ description: 'Every step done' }) live: boolean;
  @ApiProperty({
    type: GoLiveRewardDto,
    description: 'Why the reward step is (not) done',
  })
  rewards: GoLiveRewardDto;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The first scan here (collect or redeem), if any',
  })
  firstScanAt: string | null;
}

/**
 * Go-live checklist for a new merchant, from data that already exists: logo, banner, points
 * rule, a first active reward with a photo and an Arabic name, an open branch with opening
 * hours, at least one staff member invited, and a first scan. Vendor admin only (they can do
 * every step).
 */
@Injectable()
export class VendorGoLiveService {
  constructor(private readonly prisma: PrismaService) {}

  async get(ctx: StaffContext): Promise<VendorGoLiveDto> {
    const v = ctx.vendorId;
    const [vendor, rule, rewards, branches, staff, firstScan] =
      await Promise.all([
        this.prisma.vendors.findUniqueOrThrow({
          where: { id: v },
          select: { logo_url: true, banner_url: true },
        }),
        this.prisma.point_rules.count({
          where: { vendor_id: v, is_active: true },
        }),
        this.prisma.rewards.findMany({
          where: { vendor_id: v, status: 'active' },
          select: { image_url: true, name_ar: true },
        }),
        this.prisma.branches.findMany({
          where: { vendor_id: v, status: 'active' },
          select: { weekly_hours: true },
        }),
        this.prisma.staff_users.count({
          where: {
            vendor_id: v,
            status: 'active',
            role: { not: 'vendor_admin' },
          },
        }),
        // Scans always carry their QR; admin corrections never do.
        this.prisma.point_events.findFirst({
          where: { vendor_id: v, qr_code_id: { not: null } },
          orderBy: { created_at: 'asc' },
          select: { created_at: true },
        }),
      ]);

    const hasArabic = (r: { name_ar: string | null }) => !!r.name_ar?.trim();
    const done: Record<GoLiveStep, boolean> = {
      logo: !!vendor.logo_url,
      banner: !!vendor.banner_url,
      rule: rule > 0,
      reward: rewards.some((r) => !!r.image_url && hasArabic(r)),
      // with opening hours hidden, any open branch will do
      branch_hours: openingHoursEnabled() ? branches.some((b) => !!readWeek(b.weekly_hours)?.length) : branches.length > 0,
      staff: staff > 0,
      test_scan: !!firstScan,
    };
    const steps = GO_LIVE_STEPS.map((key) => ({
      key,
      done: done[key],
      to: STEP_PATH[key],
    }));
    const count = steps.filter((s) => s.done).length;
    return {
      steps,
      done: count,
      total: steps.length,
      live: count === steps.length,
      rewards: {
        active: rewards.length,
        withPhoto: rewards.filter((r) => !!r.image_url).length,
        withArabic: rewards.filter(hasArabic).length,
      },
      firstScanAt: firstScan?.created_at.toISOString() ?? null,
    };
  }
}

@VendorApi('vendor: go-live')
@Controller('vendor/go-live')
export class VendorGoLiveController {
  constructor(private readonly goLive: VendorGoLiveService) {}

  /** Go-live checklist for a new merchant: what is done and where to do the rest. */
  @Get()
  @StaffRoles('vendor_admin')
  @ApiOkResponse({ type: VendorGoLiveDto })
  get(@CurrentStaff() ctx: StaffContext): Promise<VendorGoLiveDto> {
    return this.goLive.get(ctx);
  }
}
