import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { IMAGE_CONTENT_TYPE, newImageName, toWebp } from '../storage/images';
import { BUCKETS, StorageService } from '../storage/storage.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { ListVendorsQueryDto } from './dto/list-vendors-query.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

/** Counts returned with every vendor (for the admin list). */
const withCounts = {
  _count: { select: { branches: true, staff_users: true } },
} satisfies Prisma.vendorsInclude;

export type VendorWithCounts = Prisma.vendorsGetPayload<{
  include: typeof withCounts;
}>;

/**
 * Vendor management for platform admins (/api/admin/vendors).
 * Vendors are never deleted: status=suspended hides them and blocks their staff.
 */
@Injectable()
export class VendorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  list(query: ListVendorsQueryDto): Promise<VendorWithCounts[]> {
    return this.prisma.vendors.findMany({
      where: {
        status: query.status,
        name: query.search
          ? { contains: query.search, mode: 'insensitive' }
          : undefined,
      },
      include: withCounts,
      orderBy: [{ name: 'asc' }],
    });
  }

  async get(id: string): Promise<VendorWithCounts> {
    const vendor = await this.prisma.vendors.findUnique({
      where: { id },
      include: withCounts,
    });
    if (!vendor) throw new NotFoundException({ code: 'vendor_not_found' });
    return vendor;
  }

  create(dto: CreateVendorDto): Promise<VendorWithCounts> {
    return this.prisma.vendors.create({
      data: {
        name: dto.name,
        logo_url: dto.logoUrl,
        contact_email: dto.contactEmail,
        currency: dto.currency,
      },
      include: withCounts,
    });
  }

  async update(id: string, dto: UpdateVendorDto): Promise<VendorWithCounts> {
    const vendor = await this.get(id);

    // Rule amounts and recorded purchases are in the vendor's currency:
    // once a rule exists, changing it would silently change their meaning.
    if (dto.currency !== undefined && dto.currency !== vendor.currency) {
      const rules = await this.prisma.point_rules.count({
        where: { vendor_id: id },
      });
      if (rules > 0) throw new ConflictException({ code: 'currency_locked' });
    }

    // A new logoUrl (or null) replaces an uploaded logo: its file is deleted.
    const replacesUpload =
      dto.logoUrl !== undefined && vendor.logo_path !== null && dto.logoUrl !== vendor.logo_url;

    const updated = await this.prisma.vendors.update({
      where: { id },
      data: {
        name: dto.name,
        logo_url: dto.logoUrl,
        logo_path: replacesUpload ? null : undefined,
        contact_email: dto.contactEmail,
        currency: dto.currency,
        status: dto.status,
      },
      include: withCounts,
    });
    if (replacesUpload) {
      await this.storage.removeQuietly(BUCKETS.vendors, [vendor.logo_path!]);
    }
    return updated;
  }

  /**
   * Uploads (or replaces) the vendor's logo into the public "vendors" bucket and points
   * logo_url at it. New file first, then the row, then the old file is deleted.
   */
  async setLogo(id: string, file: Buffer): Promise<VendorWithCounts> {
    const vendor = await this.get(id);
    const webp = await toWebp(file, 'logo');
    const path = `${id}/logo/${newImageName()}`;
    await this.storage.upload(BUCKETS.vendors, path, webp, IMAGE_CONTENT_TYPE);
    let updated: VendorWithCounts;
    try {
      updated = await this.prisma.vendors.update({
        where: { id },
        data: { logo_path: path, logo_url: this.storage.publicUrl(BUCKETS.vendors, path) },
        include: withCounts,
      });
    } catch (err) {
      await this.storage.removeQuietly(BUCKETS.vendors, [path]);
      throw err;
    }
    if (vendor.logo_path) {
      await this.storage.removeQuietly(BUCKETS.vendors, [vendor.logo_path]);
    }
    return updated;
  }

  /** Removes the logo: an uploaded file is deleted from Storage; logo_url is cleared. */
  async removeLogo(id: string): Promise<VendorWithCounts> {
    const vendor = await this.get(id);
    if (vendor.logo_path) {
      await this.storage.remove(BUCKETS.vendors, [vendor.logo_path]);
    }
    return this.prisma.vendors.update({
      where: { id },
      data: { logo_path: null, logo_url: null },
      include: withCounts,
    });
  }
}
