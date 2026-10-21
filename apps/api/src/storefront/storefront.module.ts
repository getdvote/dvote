import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Put,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { IsDefined, IsOptional } from 'class-validator';
import { Prisma } from '../generated/prisma/client.js';
import { AuthModule } from '../auth/auth.module';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffRoles, type StaffContext } from '../auth/staff-auth.guard';
import { VendorApi } from '../auth/vendor-api.decorator';
import { IsUuid } from '../common/uuid';
import { PrismaService } from '../prisma/prisma.service';
import { checkStorefront, readStorefront, type Storefront } from './storefront';

class StorefrontBranchDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ description: 'null = this branch uses the shop storefront' })
  storefront: Storefront | null;
}

class StorefrontSettingsDto {
  @ApiProperty({
    description:
      'The shop storefront (all branches unless a branch has its own)',
  })
  shop: Storefront;
  @ApiProperty({ type: [StorefrontBranchDto], description: 'Open branches' })
  branches: StorefrontBranchDto[];
}

class SaveStorefrontDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Save for this branch only; omit for the whole shop',
  })
  @IsOptional()
  @IsUuid()
  branchId?: string;

  @ApiProperty({
    nullable: true,
    description:
      '{sections: [...]}; null with branchId = back to the shop storefront',
  })
  @IsDefined()
  storefront: Storefront | null;
}

@Injectable()
export class StorefrontService {
  constructor(private readonly prisma: PrismaService) {}

  async get(ctx: StaffContext): Promise<StorefrontSettingsDto> {
    const [vendor, branches] = await Promise.all([
      this.prisma.vendors.findUniqueOrThrow({
        where: { id: ctx.vendorId },
        select: { storefront: true },
      }),
      this.prisma.branches.findMany({
        where: { vendor_id: ctx.vendorId, status: 'active' },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, storefront: true },
      }),
    ]);
    return {
      shop: readStorefront(vendor.storefront),
      branches: branches.map((b) => ({
        id: b.id,
        name: b.name,
        storefront: b.storefront ? readStorefront(b.storefront) : null,
      })),
    };
  }

  async save(
    ctx: StaffContext,
    dto: SaveStorefrontDto,
  ): Promise<StorefrontSettingsDto> {
    if (dto.branchId) {
      const value =
        dto.storefront === null
          ? Prisma.DbNull
          : (checkStorefront(
              dto.storefront,
            ) as unknown as Prisma.InputJsonValue);
      const { count } = await this.prisma.branches.updateMany({
        where: { id: dto.branchId, vendor_id: ctx.vendorId, status: 'active' },
        data: { storefront: value },
      });
      if (!count) throw new NotFoundException({ code: 'branch_not_found' });
    } else {
      const value =
        dto.storefront === null
          ? Prisma.DbNull
          : (checkStorefront(
              dto.storefront,
            ) as unknown as Prisma.InputJsonValue);
      await this.prisma.vendors.update({
        where: { id: ctx.vendorId },
        data: { storefront: value },
      });
    }
    return this.get(ctx);
  }
}

/** The merchant's public page sections, for the shop and per branch. Changing: merchant admins. */
@VendorApi('vendor: storefront')
@Controller('vendor/storefront')
export class StorefrontController {
  constructor(private readonly storefront: StorefrontService) {}

  @Get()
  @StaffRoles('vendor_admin', 'branch_manager', 'viewer')
  @ApiOkResponse({ type: StorefrontSettingsDto })
  get(@CurrentStaff() ctx: StaffContext) {
    return this.storefront.get(ctx);
  }

  @Put()
  @StaffRoles('vendor_admin')
  @ApiOkResponse({
    type: StorefrontSettingsDto,
    description: '400 invalid_storefront, 404 branch_not_found',
  })
  save(@CurrentStaff() ctx: StaffContext, @Body() dto: SaveStorefrontDto) {
    return this.storefront.save(ctx, dto);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [StorefrontController],
  providers: [StorefrontService],
  exports: [StorefrontService],
})
export class StorefrontModule {}
