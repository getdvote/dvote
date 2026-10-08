import { Injectable, NotFoundException } from '@nestjs/common';
import type { rewards } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRewardDto, UpdateRewardDto } from './dto/reward.dto';

/** Empty text → null (an optional field left blank in a form). */
const blankToNull = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);

/** A vendor's reward catalogue. Rewards are archived, never deleted. */
@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active first, then archived; each in display order. */
  async list(vendorId: string): Promise<rewards[]> {
    await this.assertVendor(vendorId);
    return this.prisma.rewards.findMany({
      where: { vendor_id: vendorId },
      orderBy: [{ status: 'asc' }, { sort_order: 'asc' }, { points_cost: 'asc' }],
    });
  }

  async create(vendorId: string, dto: CreateRewardDto): Promise<rewards> {
    await this.assertVendor(vendorId);
    const last = await this.prisma.rewards.aggregate({ where: { vendor_id: vendorId }, _max: { sort_order: true } });
    return this.prisma.rewards.create({
      data: {
        vendor_id: vendorId,
        name: dto.name.trim(),
        name_ar: blankToNull(dto.nameAr) ?? null,
        description: blankToNull(dto.description) ?? null,
        description_ar: blankToNull(dto.descriptionAr) ?? null,
        points_cost: dto.pointsCost,
        sort_order: dto.sortOrder ?? (last._max.sort_order ?? 0) + 1,
      },
    });
  }

  async update(id: string, dto: UpdateRewardDto): Promise<rewards> {
    const reward = await this.prisma.rewards.findUnique({ where: { id } });
    if (!reward) throw new NotFoundException({ code: 'reward_not_found' });
    return this.prisma.rewards.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        name_ar: blankToNull(dto.nameAr),
        description: blankToNull(dto.description),
        description_ar: blankToNull(dto.descriptionAr),
        points_cost: dto.pointsCost,
        sort_order: dto.sortOrder,
        status: dto.status,
      },
    });
  }

  private async assertVendor(vendorId: string) {
    const found = await this.prisma.vendors.findUnique({ where: { id: vendorId }, select: { id: true } });
    if (!found) throw new NotFoundException({ code: 'vendor_not_found' });
  }
}
