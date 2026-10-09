import { Injectable, NotFoundException } from '@nestjs/common';
import type { point_rules } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePointRuleDto } from './dto/point-rule.dto';

/**
 * Point rules are versioned and never edited: publishing a new one makes it the active rule
 * for new purchases (version + 1); earlier purchases keep the rule they were earned with.
 */
@Injectable()
export class PointRulesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every version, newest first. */
  async list(vendorId: string): Promise<point_rules[]> {
    await this.assertVendor(vendorId);
    return this.prisma.point_rules.findMany({ where: { vendor_id: vendorId }, orderBy: { version: 'desc' } });
  }

  /**
   * One transaction: retire the active rule, then add the new active version. The database
   * allows only one active rule per vendor, so the order matters.
   */
  async publish(vendorId: string, dto: CreatePointRuleDto, staffId: string | null = null): Promise<point_rules> {
    await this.assertVendor(vendorId);
    return this.prisma.$transaction(async (tx) => {
      const last = await tx.point_rules.aggregate({ where: { vendor_id: vendorId }, _max: { version: true } });
      await tx.point_rules.updateMany({ where: { vendor_id: vendorId, is_active: true }, data: { is_active: false } });
      return tx.point_rules.create({
        data: {
          vendor_id: vendorId,
          version: (last._max.version ?? 0) + 1,
          spend_amount: dto.spendAmount,
          points_per_spend: dto.pointsPerSpend,
          min_purchase: dto.minPurchase ?? 0,
          max_points_per_purchase: dto.maxPointsPerPurchase ?? null,
          is_active: true,
          created_by_staff_id: staffId,
        },
      });
    });
  }

  /** Stop earning at this vendor (collects then answer no_active_rule) until a new rule is published. */
  async deactivate(vendorId: string): Promise<void> {
    await this.assertVendor(vendorId);
    await this.prisma.point_rules.updateMany({ where: { vendor_id: vendorId, is_active: true }, data: { is_active: false } });
  }

  private async assertVendor(vendorId: string) {
    const found = await this.prisma.vendors.findUnique({ where: { id: vendorId }, select: { id: true } });
    if (!found) throw new NotFoundException({ code: 'vendor_not_found' });
  }
}
