import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { fromMinor, toMinor, type DecimalLike } from '../points/points';
import { activeSoldOut } from '../rewards/reward-sold-outs.service';
import { activePause, readWeek } from '../branches/hours';
import { PrismaService } from '../prisma/prisma.service';
import { BUCKETS, StorageService } from '../storage/storage.service';
import { MAX_BRANCH_PHOTOS } from '../vendor-images/vendor-images.service';
import { NearbyVendorsResponseDto, VendorListItemDto } from './dto/vendor-list-item.dto';
import { VendorPageResponseDto } from './dto/vendor-page-response.dto';

const money = (v: DecimalLike) => fromMinor(toMinor(v));

/** What the Explore / nearby cards need per shop (my card there included). */
const listInclude = (userId: string) =>
  ({
    point_rules: { where: { is_active: true }, take: 1 },
    branches: { where: { status: 'active' }, orderBy: { name: 'asc' }, select: { address: true } },
    cards: { where: { user_id: userId }, take: 1, select: { balance: true } },
    _count: { select: { rewards: { where: { status: 'active' } } } },
  }) satisfies Prisma.vendorsInclude;
type ListVendor = Prisma.vendorsGetPayload<{ include: ReturnType<typeof listInclude> }>;

function toListItem(v: ListVendor): VendorListItemDto {
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
}

/** Category names people type, in English and Arabic → the stored codes (partial words count). */
const CATEGORY_WORDS: Record<string, string[]> = {
  cafe: ['cafe', 'café', 'coffee', 'coffee shop', 'مقهى', 'كافيه', 'قهوة'],
  cafe_restaurant: ['cafe & restaurant', 'café & restaurant', 'cafe restaurant', 'مقهى ومطعم'],
  restaurant: ['restaurant', 'food', 'مطعم'],
  bakery: ['bakery', 'bread', 'مخبز', 'مخبوزات'],
  desserts: ['desserts', 'dessert', 'sweets', 'cake', 'حلويات', 'حلو'],
  juice_bar: ['juice bar', 'juice', 'juices', 'عصير', 'عصائر', 'محل عصائر'],
};
function categoriesMatching(term: string): string[] {
  const t = term.toLowerCase();
  if (t.length < 3) return []; // "a" or "ca" would match nearly every category
  return Object.entries(CATEGORY_WORDS)
    .filter(([code, words]) => code.replace('_', ' ').includes(t) || words.some((w) => w.includes(t) || t.includes(w)))
    .map(([code]) => code);
}

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
   * branches, where it is) and the customer's points there. `search` matches any of: the shop
   * name, its category (English or Arabic, e.g. "bakery" / "مخبز"), an open branch's name,
   * city or address, or an active reward's name (English or Arabic).
   */
  async list(userId: string, search?: string): Promise<VendorListItemDto[]> {
    const term = search?.trim();
    const contains = { contains: term ?? '', mode: 'insensitive' as const };
    const vendors = await this.prisma.vendors.findMany({
      where: {
        status: 'active',
        ...(term
          ? {
              OR: [
                { name: contains },
                { category: { in: categoriesMatching(term) } },
                { branches: { some: { status: 'active', OR: [{ name: contains }, { city: contains }, { address: contains }] } } },
                { rewards: { some: { status: 'active', OR: [{ name: contains }, { name_ar: contains }] } } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      include: listInclude(userId),
    });
    return vendors.map(toListItem);
  }

  /**
   * "Near you": active shops with an open branch that has a map location, nearest first.
   * Distance = to that shop's closest open branch (great-circle, km). Uses the position sent
   * now (lat/lng) or else the customer's last saved one; none known → located: false.
   */
  async nearby(userId: string, at: { lat?: number; lng?: number }, limit = 10): Promise<NearbyVendorsResponseDto> {
    let lat = at.lat;
    let lng = at.lng;
    if (lat === undefined || lng === undefined) {
      const me = await this.prisma.users.findUniqueOrThrow({ where: { id: userId }, select: { last_lat: true, last_lng: true } });
      if (me.last_lat === null || me.last_lng === null) return { located: false, items: [] };
      lat = Number(me.last_lat);
      lng = Number(me.last_lng);
    }

    const nearest = await this.prisma.$queryRaw<{ vendor_id: string; branch_name: string; km: number }[]>`
      SELECT vendor_id, branch_name, km FROM (
        SELECT DISTINCT ON (b.vendor_id) b.vendor_id, b.name AS branch_name,
               6371 * 2 * asin(sqrt(
                 power(sin(radians((b.lat::float8 - ${lat}::float8) / 2)), 2) +
                 cos(radians(${lat}::float8)) * cos(radians(b.lat::float8)) *
                 power(sin(radians((b.lng::float8 - ${lng}::float8) / 2)), 2)
               )) AS km
        FROM branches b JOIN vendors v ON v.id = b.vendor_id
        WHERE v.status = 'active' AND b.status = 'active' AND b.lat IS NOT NULL AND b.lng IS NOT NULL
        ORDER BY b.vendor_id, km
      ) n
      ORDER BY km, vendor_id
      LIMIT ${limit}`;
    if (!nearest.length) return { located: true, items: [] };

    const vendors = await this.prisma.vendors.findMany({
      where: { id: { in: nearest.map((n) => n.vendor_id) } },
      include: listInclude(userId),
    });
    const byId = new Map(vendors.map((v) => [v.id, toListItem(v)]));
    return {
      located: true,
      items: nearest
        .filter((n) => byId.has(n.vendor_id))
        .map((n) => ({ ...byId.get(n.vendor_id)!, distanceKm: Math.round(Number(n.km) * 10) / 10, nearestBranch: n.branch_name })),
    };
  }

  async get(vendorId: string, userId: string): Promise<VendorPageResponseDto> {
    const vendor = await this.prisma.vendors.findFirst({
      where: { id: vendorId, status: 'active' },
      include: {
        point_rules: { where: { is_active: true }, take: 1 },
        rewards: {
          where: { status: 'active' },
          orderBy: [{ sort_order: 'asc' }, { points_cost: 'asc' }],
          include: {
            reward_sold_outs: {
              where: { branches: { status: 'active' }, ...activeSoldOut() },
              include: { branches: { select: { name: true } } },
            },
          },
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
        soldOutEverywhere: vendor.branches.length > 0 && r.reward_sold_outs.length >= vendor.branches.length,
        soldOutAt: r.reward_sold_outs.map((o) => ({
          branchId: o.branch_id,
          branchName: o.branches.name,
          until: o.sold_out_until?.toISOString() ?? null,
        })),
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
        hours: readWeek(b.weekly_hours),
        pausedUntil: activePause(b.paused_until),
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
