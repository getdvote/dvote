import { Injectable, NotFoundException } from '@nestjs/common';
import type { branches } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

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
    return this.prisma.branches.create({
      data: {
        vendor_id: vendorId,
        name: dto.name.trim(),
        address: dto.address?.trim() || null,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        timezone: dto.timezone ?? undefined,
      },
    });
  }

  async update(id: string, dto: UpdateBranchDto): Promise<branches> {
    const branch = await this.prisma.branches.findUnique({ where: { id } });
    if (!branch) throw new NotFoundException({ code: 'branch_not_found' });
    return this.prisma.branches.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        address: dto.address === undefined ? undefined : dto.address?.trim() || null,
        lat: dto.lat,
        lng: dto.lng,
        timezone: dto.timezone,
        status: dto.status,
      },
    });
  }

  private async assertVendor(vendorId: string) {
    const found = await this.prisma.vendors.findUnique({ where: { id: vendorId }, select: { id: true } });
    if (!found) throw new NotFoundException({ code: 'vendor_not_found' });
  }
}
