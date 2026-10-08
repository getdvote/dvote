import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.vendors.update({
      where: { id },
      data: {
        name: dto.name,
        logo_url: dto.logoUrl,
        contact_email: dto.contactEmail,
        currency: dto.currency,
        status: dto.status,
      },
      include: withCounts,
    });
  }
}
