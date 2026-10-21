import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type branches } from '../generated/prisma/client.js';
import type { StaffContext } from '../auth/staff-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';
import { assertWeek, everyDay, legacyPair, type HoursSlot } from './hours';

/** Stored as plain {day, opensAt, closesAt} objects (no DTO class fields). */
const asJson = (slots: HoursSlot[]) =>
  slots.map((s) => ({ day: s.day, opensAt: s.opensAt, closesAt: s.closesAt })) as Prisma.InputJsonArray;

/** Longest "temporarily closed"; longer than that, close the branch instead. */
const MAX_PAUSE_DAYS = 14;

/** A map location is both lat and lng, or neither (400 location_incomplete). */
function assertLocation(lat: unknown, lng: unknown) {
  if ((lat === null) !== (lng === null)) throw new BadRequestException({ code: 'location_incomplete' });
}

/** Opening hours are both times or neither (400 hours_incomplete), and not the same time (400 hours_invalid). */
function assertHours(opens: string | null, closes: string | null) {
  if ((opens === null) !== (closes === null)) throw new BadRequestException({ code: 'hours_incomplete' });
  if (opens !== null && opens === closes) throw new BadRequestException({ code: 'hours_invalid' });
}

/** A vendor's branches. Never deleted: status=closed hides them and blocks their staff. */
@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(vendorId: string): Promise<branches[]> {
    await this.assertVendor(vendorId);
    return this.prisma.branches.findMany({
      where: { vendor_id: vendorId },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }

  async create(vendorId: string, dto: CreateBranchDto): Promise<branches> {
    await this.assertVendor(vendorId);
    assertLocation(dto.lat ?? null, dto.lng ?? null);
    const week = this.week(dto, null, null);
    return this.prisma.branches.create({
      data: {
        vendor_id: vendorId,
        name: dto.name.trim(),
        address: dto.address?.trim() || null,
        city: dto.city ?? null,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        timezone: dto.timezone ?? undefined,
        ...week,
      },
    });
  }

  /** vendorId (vendor dashboard): the branch must belong to that vendor, else branch_not_found. */
  async update(id: string, dto: UpdateBranchDto, vendorId?: string): Promise<branches> {
    const branch = await this.prisma.branches.findUnique({ where: { id } });
    if (!branch || (vendorId && branch.vendor_id !== vendorId)) throw new NotFoundException({ code: 'branch_not_found' });
    assertLocation(dto.lat === undefined ? branch.lat : dto.lat, dto.lng === undefined ? branch.lng : dto.lng);
    const week = this.week(dto, branch.opens_at, branch.closes_at);
    return this.prisma.branches.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        address: dto.address === undefined ? undefined : dto.address?.trim() || null,
        city: dto.city,
        lat: dto.lat,
        lng: dto.lng,
        timezone: dto.timezone,
        ...week,
        status: dto.status,
      },
    });
  }

  /**
   * Temporarily closed until `until` (null = open again). Vendor admin: any of their branches;
   * branch manager: their own (403 forbidden_branch). Customers see it on the shop page.
   */
  async setPause(ctx: StaffContext, id: string, until: string | null): Promise<branches> {
    const branch = await this.prisma.branches.findFirst({ where: { id, vendor_id: ctx.vendorId } });
    if (!branch) throw new NotFoundException({ code: 'branch_not_found' });
    if (ctx.role !== 'vendor_admin' && ctx.branchId !== id) throw new ForbiddenException({ code: 'forbidden_branch' });
    const end = until === null ? null : new Date(until);
    if (end) {
      if (end.getTime() <= Date.now()) throw new BadRequestException({ code: 'until_in_past' });
      if (end.getTime() > Date.now() + MAX_PAUSE_DAYS * 86_400_000) throw new BadRequestException({ code: 'until_too_far' });
    }
    return this.prisma.branches.update({ where: { id }, data: { paused_until: end } });
  }

  /**
   * The hours columns to write. `hours` (per weekday) wins; otherwise an old client's single
   * opensAt/closesAt pair becomes the same slot every day. The legacy pair is kept in step.
   */
  private week(dto: Partial<CreateBranchDto>, opens: string | null, closes: string | null) {
    if (dto.hours !== undefined) {
      const slots: HoursSlot[] | null = dto.hours?.length ? assertWeek(dto.hours) : null;
      const pair = legacyPair(slots);
      return { weekly_hours: slots ? asJson(slots) : Prisma.DbNull, opens_at: pair.opensAt, closes_at: pair.closesAt };
    }
    if (dto.opensAt === undefined && dto.closesAt === undefined) return {};
    const o = dto.opensAt === undefined ? opens : dto.opensAt;
    const c = dto.closesAt === undefined ? closes : dto.closesAt;
    assertHours(o, c);
    return { weekly_hours: o && c ? asJson(everyDay(o, c)) : Prisma.DbNull, opens_at: o, closes_at: c };
  }

  private async assertVendor(vendorId: string) {
    const found = await this.prisma.vendors.findUnique({ where: { id: vendorId }, select: { id: true } });
    if (!found) throw new NotFoundException({ code: 'vendor_not_found' });
  }
}
