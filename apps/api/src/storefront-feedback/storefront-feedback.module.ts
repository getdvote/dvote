import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthModule } from '../auth/auth.module';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffRoles, type StaffContext } from '../auth/staff-auth.guard';
import { VendorApi } from '../auth/vendor-api.decorator';
import { IsUuid } from '../common/uuid';
import { PrismaService } from '../prisma/prisma.service';
import { egyptianMobile } from '../public-join/egyptian-phone';
import { UserLimit } from '../rate-limit/rate-limit';
import { readStorefront } from '../storefront/storefront';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class SubmitStorefrontFeedbackDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsUuid() branchId?: string;
}

export interface FeedbackRow {
  id: string;
  name: string;
  phone: string | null;
  message: string;
  createdAt: Date;
  branchName: string | null;
  existingCustomer: boolean;
}

@Injectable()
export class StorefrontFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(slug: string, dto: SubmitStorefrontFeedbackDto) {
    const phone = dto.phone ? egyptianMobile(dto.phone) : null;
    if (dto.phone && !phone)
      throw new BadRequestException({ code: 'invalid_phone' });
    const vendor = await this.prisma.vendors.findUnique({
      where: { slug },
      select: { id: true, status: true, storefront: true },
    });
    if (!vendor || vendor.status !== 'active')
      throw new NotFoundException({ code: 'vendor_not_found' });
    const branch = dto.branchId
      ? await this.prisma.branches.findFirst({
          where: { id: dto.branchId, vendor_id: vendor.id, status: 'active' },
          select: { id: true, storefront: true },
        })
      : null;
    if (dto.branchId && !branch)
      throw new BadRequestException({ code: 'invalid_branch' });
    if (
      !readStorefront(branch?.storefront ?? vendor.storefront).sections.some(
        (s) => s.type === 'feedback',
      )
    ) {
      throw new NotFoundException({ code: 'feedback_unavailable' });
    }
    // A phone match is only an association for the merchant, never proof of identity.
    // Never create or update users/cards here, and never return the match publicly.
    const card = phone
      ? await this.prisma.cards.findFirst({
          where: { vendor_id: vendor.id, users: { phone } },
          select: { id: true },
          orderBy: { created_at: 'asc' },
        })
      : null;
    await this.prisma
      .$executeRaw`INSERT INTO vendor_feedback (vendor_id, branch_id, card_id, name, phone, message)
      VALUES (${vendor.id}::uuid, ${branch?.id ?? null}::uuid, ${card?.id ?? null}::uuid, ${dto.name}, ${phone}, ${dto.message})`;
    return { received: true };
  }

  async list(ctx: StaffContext, pageText?: string) {
    const page = Math.max(1, Math.min(100000, Number(pageText) || 1));
    if (!Number.isInteger(page))
      throw new BadRequestException({ code: 'invalid_page' });
    const offset = (page - 1) * 20;
    const rows = await this.prisma.$queryRaw<
      FeedbackRow[]
    >`SELECT f.id, f.name, f.phone, f.message,
      f.created_at AS "createdAt", b.name AS "branchName", (f.card_id IS NOT NULL) AS "existingCustomer"
      FROM vendor_feedback f LEFT JOIN branches b ON b.id = f.branch_id AND b.vendor_id = f.vendor_id
      WHERE f.vendor_id = ${ctx.vendorId}::uuid AND (${ctx.branchId}::uuid IS NULL OR f.branch_id = ${ctx.branchId}::uuid)
      ORDER BY f.created_at DESC, f.id DESC LIMIT 21 OFFSET ${offset}`;
    return { items: rows.slice(0, 20), page, hasMore: rows.length > 20 };
  }
}

@Controller('public/vendors/:slug/feedback')
export class PublicStorefrontFeedbackController {
  constructor(private readonly feedback: StorefrontFeedbackService) {}
  @Post()
  @HttpCode(200)
  @UserLimit(5)
  submit(
    @Param('slug') slug: string,
    @Body() dto: SubmitStorefrontFeedbackDto,
  ) {
    return this.feedback.submit(slug.toLowerCase(), dto);
  }
}

@VendorApi('vendor: customer feedback')
@Controller('vendor/customer-feedback')
export class StorefrontFeedbackController {
  constructor(private readonly feedback: StorefrontFeedbackService) {}
  @Get()
  @StaffRoles('vendor_admin', 'branch_manager', 'viewer')
  list(@CurrentStaff() ctx: StaffContext, @Query('page') page?: string) {
    return this.feedback.list(ctx, page);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [
    PublicStorefrontFeedbackController,
    StorefrontFeedbackController,
  ],
  providers: [StorefrontFeedbackService],
  exports: [StorefrontFeedbackService],
})
export class StorefrontFeedbackModule {}
