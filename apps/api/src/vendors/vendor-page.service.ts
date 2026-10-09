import { Injectable, NotFoundException } from '@nestjs/common';
import { fromMinor, toMinor, type DecimalLike } from '../points/points';
import { PrismaService } from '../prisma/prisma.service';
import { BUCKETS, StorageService } from '../storage/storage.service';
import { MAX_BRANCH_PHOTOS } from '../vendor-images/vendor-images.service';
import { VendorListItemDto } from './dto/vendor-list-item.dto';
import { VendorPageResponseDto } from './dto/vendor-page-response.dto';

const money = (v: DecimalLike) => fromMinor(toMinor(v));

/**
 * The customer app's shop page: the active rule, active rewards, menu pages and open
 * branches (with their photos) of an active vendor, plus the customer's own card there.
 * Nothing about staff or other customers.
 */
@Injectable()
export class VendorPageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Explore: every active shop, A–Z, with a short summary (rule, how many rewards and
   * branches, where it is) and the customer's points there. Optionally filtered by name.
   */
  async list(userId: string, search?: string): Promise<VendorListItemDto[]> {
    const vendors = await this.prisma.vendors.findMany({
      where: {
        status: 'active',
        ...(search?.trim() ? { name: { contains: search.trim(), mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
      include: {
        point_rules: { where: { is_active: true }, take: 1 },
        branches: { where: { status: 'active' }, orderBy: { name: 'asc' }, select: { address: true } },
        cards: { where: { user_id: userId }, take: 1, select: { balance: true } },
        _count: { select: { rewards: { where: { status: 'active' } } } },
      },
    });
    return vendors.map((v) => {
      const [rule] = v.point_rules;
      return {
        id: v.id,
        name: v.name,
        logoUrl: v.logo_url,
        bannerUrl: v.banner_url,
        category: v.category,
        cardDesign: v.card_design,
        currency: v.currency,
        rule: rule ? { spendAmount: money(rule.spend_amount), pointsPerSpend: rule.points_per_spend } : null,
        rewardsCount: v._count.rewards,
        branchesCount: v.branches.length,
        firstAddress: v.branches.find((b) => b.address)?.address ?? null,
        myBalance: v.cards[0]?.balance ?? null,
      };
    });
  }

  async get(vendorId: string, userId: string): Promise<VendorPageResponseDto> {
    const vendor = await this.prisma.vendors.findFirst({
      where: { id: vendorId, status: 'active' },
      include: {
        point_rules: { where: { is_active: true }, take: 1 },
        rewards: {
          where: { status: 'active' },
          orderBy: [{ sort_order: 'asc' }, { points_cost: 'asc' }],
        },
        branches: { where: { status: 'active' }, orderBy: { name: 'asc' } },
        vendor_images: { orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }] },
        cards: { where: { user_id: userId }, take: 1 },
      },
    });
    if (!vendor) throw new NotFoundException({ code: 'vendor_not_found' });

    const image = (i: { id: string; storage_path: string }) => ({
      id: i.id,
      url: this.storage.publicUrl(BUCKETS.vendors, i.storage_path),
    });
    const [rule] = vendor.point_rules;
    const [card] = vendor.cards;

    return {
      id: vendor.id,
      name: vendor.name,
      logoUrl: vendor.logo_url,
      bannerUrl: vendor.banner_url,
      category: vendor.category,
      cardDesign: vendor.card_design,
      currency: vendor.currency,
      rule: rule
        ? {
            spendAmount: money(rule.spend_amount),
            pointsPerSpend: rule.points_per_spend,
            minPurchase: money(rule.min_purchase),
            maxPointsPerPurchase: rule.max_points_per_purchase,
          }
        : null,
      rewards: vendor.rewards.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        nameAr: r.name_ar,
        descriptionAr: r.description_ar,
        imageUrl: r.image_url,
        pointsCost: r.points_cost,
      })),
      menu: vendor.vendor_images.filter((i) => i.kind === 'menu').map(image),
      branches: vendor.branches.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        city: b.city,
        lat: b.lat === null ? null : Number(b.lat),
        lng: b.lng === null ? null : Number(b.lng),
        opensAt: b.opens_at,
        closesAt: b.closes_at,
        photos: vendor.vendor_images
          .filter((i) => i.kind === 'branch_photo' && i.branch_id === b.id)
          .slice(0, MAX_BRANCH_PHOTOS) // branches from before the limit may have more
          .map(image),
      })),
      card: card
        ? { id: card.id, balance: card.balance, lifetimePoints: card.lifetime_points }
        : null,
    };
  }
}
