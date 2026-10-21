import {
  ConflictException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { IMAGE_CONTENT_TYPE, newImageName, toWebp } from '../storage/images';
import { BUCKETS, StorageService } from '../storage/storage.service';
import { WalletLogoService } from '../storage/wallet-logo.service';
import { logoFiles } from '../storage/wallet-logo';
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
    private readonly walletLogos: WalletLogoService,
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

  async usernameAvailability(vendorId: string, username: string) {
    const [result] = await this.prisma.$queryRaw<{ reserved: boolean }[]>`SELECT vendor_slug_reserved(${username}) AS reserved`;
    if (result.reserved) return { available: false };
    const existing = await this.prisma.vendors.findUnique({ where: { slug: username }, select: { id: true } });
    return { available: !existing || existing.id === vendorId };
  }

  async reserveUsername(vendorId: string, username: string): Promise<VendorWithCounts> {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(username) || username.length < 2 || username.length > 50) throw new BadRequestException({ code: 'invalid_username' });
    if (!(await this.usernameAvailability(vendorId, username)).available) throw new ConflictException({ code: 'username_taken' });
    try {
      return await this.prisma.vendors.update({ where: { id: vendorId }, data: { slug: username }, include: withCounts });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ code: 'username_taken' });
      throw e;
    }
  }

  create(dto: CreateVendorDto): Promise<VendorWithCounts> {
    return this.prisma.vendors.create({
      data: {
        name: dto.name,
        logo_url: dto.logoUrl,
        contact_email: dto.contactEmail,
        currency: dto.currency,
        category: dto.category,
        card_design: dto.cardDesign,
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
        contact_phone: dto.contactPhone,
        page_style: dto.pageStyle,
        brand_primary: dto.brandPrimary,
        brand_secondary: dto.brandSecondary,
        brand_font: dto.brandFont,
        currency: dto.currency,
        status: dto.status,
        category: dto.category,
        card_design: dto.cardDesign,
      },
      include: withCounts,
    });
    if (replacesUpload) {
      await this.storage.removeQuietly(BUCKETS.vendors, logoFiles(vendor.logo_path!));
    }
    return updated;
  }

  /** Uploads (or replaces) the logo: <vendorId>/logo/<uuid>.webp in the public "vendors" bucket. */
  setLogo(id: string, file: Buffer): Promise<VendorWithCounts> {
    return this.setImage(id, file, 'logo');
  }

  /** Removes the logo: an uploaded file is deleted from Storage; logo_url is cleared. */
  removeLogo(id: string): Promise<VendorWithCounts> {
    return this.removeImage(id, 'logo');
  }

  /** Uploads (or replaces) the shop-page banner: <vendorId>/banner/<uuid>.webp. */
  setBanner(id: string, file: Buffer): Promise<VendorWithCounts> {
    return this.setImage(id, file, 'banner');
  }

  /** Removes the banner (file deleted, banner_url cleared). */
  removeBanner(id: string): Promise<VendorWithCounts> {
    return this.removeImage(id, 'banner');
  }

  /** New file first, then the row, then the old file is deleted. */
  private async setImage(id: string, file: Buffer, kind: 'logo' | 'banner'): Promise<VendorWithCounts> {
    const vendor = await this.get(id);
    const webp = await toWebp(file, kind);
    const path = `${id}/${kind}/${newImageName()}`;
    await this.storage.upload(BUCKETS.vendors, path, webp, IMAGE_CONTENT_TYPE);
    const url = this.storage.publicUrl(BUCKETS.vendors, path);
    let updated: VendorWithCounts;
    try {
      if (kind === 'logo') await this.walletLogos.ensure(path, webp);
      updated = await this.prisma.vendors.update({
        where: { id },
        data: kind === 'logo' ? { logo_path: path, logo_url: url } : { banner_path: path, banner_url: url },
        include: withCounts,
      });
    } catch (err) {
      await this.storage.removeQuietly(BUCKETS.vendors, kind === 'logo' ? logoFiles(path) : [path]);
      throw err;
    }
    const old = kind === 'logo' ? vendor.logo_path : vendor.banner_path;
    if (old) await this.storage.removeQuietly(BUCKETS.vendors, kind === 'logo' ? logoFiles(old) : [old]);
    return updated;
  }

  private async removeImage(id: string, kind: 'logo' | 'banner'): Promise<VendorWithCounts> {
    const vendor = await this.get(id);
    const old = kind === 'logo' ? vendor.logo_path : vendor.banner_path;
    if (old) await this.storage.remove(BUCKETS.vendors, kind === 'logo' ? logoFiles(old) : [old]);
    return this.prisma.vendors.update({
      where: { id },
      data: kind === 'logo' ? { logo_path: null, logo_url: null } : { banner_path: null, banner_url: null },
      include: withCounts,
    });
  }
}
