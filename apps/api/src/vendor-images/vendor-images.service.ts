import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { vendor_images } from '../generated/prisma/client.js';
import type { StaffContext } from '../auth/staff-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { IMAGE_CONTENT_TYPE, newImageName, toWebp } from '../storage/images';
import { BUCKETS, StorageService } from '../storage/storage.service';
import { CreateVendorImageDto } from './dto/create-vendor-image.dto';
import { ListVendorImagesQueryDto } from './dto/list-vendor-images-query.dto';
import { VendorImageResponseDto } from './dto/vendor-image-response.dto';

/** Most images a vendor can have: menu pages per vendor, photos per branch. */
export const MAX_MENU_IMAGES = 20;
export const MAX_BRANCH_PHOTOS = 3;

/**
 * Menu pages and branch photos in the public "vendors" bucket:
 *   <vendor id>/menu/<file>.webp, <vendor id>/branches/<branch id>/<file>.webp
 * vendor_admin manages all of them; branch_manager only the photos of their own branch.
 * Deleting an image deletes its file and its row.
 */
@Injectable()
export class VendorImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * A platform admin acts like the vendor's own admin (menu pages + any branch's photos).
   * Unknown vendor → vendor_not_found.
   */
  async adminContext(vendorId: string): Promise<StaffContext> {
    const vendor = await this.prisma.vendors.findUnique({ where: { id: vendorId }, select: { id: true } });
    if (!vendor) throw new NotFoundException({ code: 'vendor_not_found' });
    return { staffId: 'platform-admin', vendorId, branchId: null, role: 'vendor_admin' };
  }

  async list(ctx: StaffContext, query: ListVendorImagesQueryDto): Promise<VendorImageResponseDto[]> {
    const images = await this.prisma.vendor_images.findMany({
      where: { vendor_id: ctx.vendorId, kind: query.kind, branch_id: query.branchId },
      orderBy: [{ kind: 'asc' }, { branch_id: 'asc' }, { sort_order: 'asc' }, { created_at: 'asc' }],
    });
    return images.map((i) => this.present(i));
  }

  async create(
    ctx: StaffContext,
    dto: CreateVendorImageDto,
    file: Buffer,
  ): Promise<VendorImageResponseDto> {
    const branchId = await this.targetBranch(ctx, dto);
    const where = { vendor_id: ctx.vendorId, kind: dto.kind, branch_id: branchId };
    const max = dto.kind === 'menu' ? MAX_MENU_IMAGES : MAX_BRANCH_PHOTOS;
    if ((await this.prisma.vendor_images.count({ where })) >= max) {
      throw new ConflictException({
        code: 'too_many_images',
        message: `At most ${max} ${dto.kind === 'menu' ? 'menu pages' : 'photos per branch'}; delete one first`,
      });
    }

    const webp = await toWebp(file, dto.kind);
    const folder = dto.kind === 'menu' ? 'menu' : `branches/${branchId}`;
    const path = `${ctx.vendorId}/${folder}/${newImageName()}`;
    await this.storage.upload(BUCKETS.vendors, path, webp, IMAGE_CONTENT_TYPE);
    try {
      const last = await this.prisma.vendor_images.aggregate({ where, _max: { sort_order: true } });
      const image = await this.prisma.vendor_images.create({
        data: { ...where, storage_path: path, sort_order: (last._max.sort_order ?? -1) + 1 },
      });
      return this.present(image);
    } catch (err) {
      await this.storage.removeQuietly(BUCKETS.vendors, [path]);
      throw err;
    }
  }

  /** Deletes the file from Storage, then the row. Images of other vendors (or, for a branch manager, other branches) are "not found". */
  async remove(ctx: StaffContext, id: string): Promise<void> {
    const image = await this.prisma.vendor_images.findFirst({
      where: {
        id,
        vendor_id: ctx.vendorId,
        ...(ctx.role === 'vendor_admin' ? {} : { kind: 'branch_photo', branch_id: ctx.branchId }),
      },
    });
    if (!image) throw new NotFoundException({ code: 'image_not_found' });
    await this.storage.remove(BUCKETS.vendors, [image.storage_path]);
    await this.prisma.vendor_images.delete({ where: { id: image.id } });
  }

  /** Which branch the new image belongs to (null for menu pages), enforcing role rules. */
  private async targetBranch(ctx: StaffContext, dto: CreateVendorImageDto): Promise<string | null> {
    if (dto.kind === 'menu') {
      if (ctx.role !== 'vendor_admin') throw new ForbiddenException({ code: 'forbidden_role' });
      if (dto.branchId) throw new BadRequestException({ code: 'branch_not_allowed' });
      return null;
    }
    const branchId = dto.branchId ?? (ctx.role === 'vendor_admin' ? null : ctx.branchId);
    if (!branchId) throw new BadRequestException({ code: 'branch_required' });
    if (ctx.role !== 'vendor_admin' && branchId !== ctx.branchId) {
      throw new ForbiddenException({ code: 'forbidden_branch' });
    }
    const branch = await this.prisma.branches.findFirst({
      where: { id: branchId, vendor_id: ctx.vendorId, status: 'active' },
      select: { id: true },
    });
    if (!branch) throw new BadRequestException({ code: 'invalid_branch' });
    return branch.id;
  }

  private present(image: vendor_images): VendorImageResponseDto {
    return VendorImageResponseDto.from(image, this.storage.publicUrl(BUCKETS.vendors, image.storage_path));
  }
}
