import { Injectable, NotFoundException } from '@nestjs/common';
import type { rewards } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { IMAGE_CONTENT_TYPE, newImageName, toWebp } from '../storage/images';
import { BUCKETS, StorageService } from '../storage/storage.service';
import { CreateRewardDto, UpdateRewardDto } from './dto/reward.dto';

/** Empty text → null (an optional field left blank in a form). */
const blankToNull = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);

/** A vendor's reward catalogue. Rewards are archived, never deleted. */
@Injectable()
export class RewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

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

  /** vendorId (vendor dashboard): the reward must belong to that vendor, else reward_not_found. */
  async update(id: string, dto: UpdateRewardDto, vendorId?: string): Promise<rewards> {
    await this.get(id, vendorId);
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

  /**
   * Upload or replace the reward's photo (bucket "vendors", <vendorId>/rewards/<uuid>.webp).
   * New file first, then the row, then the old file is deleted.
   */
  async setImage(id: string, file: Buffer, vendorId?: string): Promise<rewards> {
    const reward = await this.get(id, vendorId);
    const webp = await toWebp(file, 'reward');
    const path = `${reward.vendor_id}/rewards/${newImageName()}`;
    await this.storage.upload(BUCKETS.vendors, path, webp, IMAGE_CONTENT_TYPE);
    let updated: rewards;
    try {
      updated = await this.prisma.rewards.update({
        where: { id },
        data: { image_path: path, image_url: this.storage.publicUrl(BUCKETS.vendors, path) },
      });
    } catch (err) {
      await this.storage.removeQuietly(BUCKETS.vendors, [path]);
      throw err;
    }
    if (reward.image_path) await this.storage.removeQuietly(BUCKETS.vendors, [reward.image_path]);
    return updated;
  }

  /** Remove the photo: the file is deleted from Storage, then the link is cleared. */
  async removeImage(id: string, vendorId?: string): Promise<rewards> {
    const reward = await this.get(id, vendorId);
    if (reward.image_path) await this.storage.remove(BUCKETS.vendors, [reward.image_path]);
    return this.prisma.rewards.update({ where: { id }, data: { image_path: null, image_url: null } });
  }

  /** vendorId set: the reward must belong to that vendor (other vendors' rewards: not found). */
  private async get(id: string, vendorId?: string): Promise<rewards> {
    const reward = await this.prisma.rewards.findUnique({ where: { id } });
    if (!reward || (vendorId && reward.vendor_id !== vendorId)) throw new NotFoundException({ code: 'reward_not_found' });
    return reward;
  }

  private async assertVendor(vendorId: string) {
    const found = await this.prisma.vendors.findUnique({ where: { id: vendorId }, select: { id: true } });
    if (!found) throw new NotFoundException({ code: 'vendor_not_found' });
  }
}
