import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
} from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Prisma } from '../generated/prisma/client.js';
import { AuthModule } from '../auth/auth.module';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffRoles, type StaffContext } from '../auth/staff-auth.guard';
import { VendorApi } from '../auth/vendor-api.decorator';
import { ParseUuidPipe } from '../common/uuid';
import { PointRulesModule } from '../point-rules/point-rules.module';
import { PointRulesService } from '../point-rules/point-rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApiImageUpload } from '../storage/api-image-upload.decorator';
import { IMAGE_CONTENT_TYPE, newImageName, toWebp } from '../storage/images';
import { StorageModule } from '../storage/storage.module';
import { BUCKETS, StorageService } from '../storage/storage.service';
import { checkDesign, readDesign, type CardDesign } from './card-design';

/** A cancelled card can be restored for this many days. */
export const RESTORE_DAYS = 30;
const DAY = 86_400_000;

export type CardStatus = 'active' | 'paused' | 'cancelled';

class CreateLoyaltyCardDto {
  @ApiProperty({ example: 'Joy Corner rewards' })
  @IsString()
  @Length(1, 60)
  name: string;

  @ApiProperty({ example: 10, description: 'Money spent for 1 point (merchant currency)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  spendAmount: number;

  @ApiProperty({ description: 'The card look (see card-design.ts)' })
  @IsDefined()
  design: unknown;
}

class UpdateLoyaltyCardSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 60)
  name?: string;

  @ApiPropertyOptional({ description: 'Money spent for 1 point' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  spendAmount?: number;
}

class SaveVersionDto {
  @ApiProperty({ description: 'The card look (see card-design.ts)' })
  @IsDefined()
  design: unknown;
}

class MembersQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 100) search?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
}

export interface LoyaltyCardView {
  card: {
    id: string;
    name: string;
    status: CardStatus;
    cancelledAt: string | null;
    restorableUntil: string | null;
    liveVersionId: string | null;
    createdAt: string;
  } | null;
  design: CardDesign | null;
  versions: { id: string; number: number; createdAt: string; createdBy: string | null; live: boolean }[];
  counts: { members: number; active30d: number };
  rule: { spendAmount: string; pointsPerSpend: number } | null;
  /** May a new card be made now (none, or the cancelled one can no longer be restored)? */
  canCreate: boolean;
}

const restorableUntil = (cancelledAt: Date | null) =>
  cancelledAt ? new Date(cancelledAt.getTime() + RESTORE_DAYS * DAY) : null;

/**
 * The merchant's loyalty card (one per merchant): status, name, points rule, and its look as
 * immutable versions with one live. Every write bumps vendors.updated_at in the same
 * transaction, so the Google Wallet sync (LiveInterceptor → vendorChanged, and the
 * reconcile checkpoint) re-sends the passes.
 */
@Injectable()
export class LoyaltyCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: PointRulesService,
    private readonly storage: StorageService,
  ) {}

  async get(ctx: StaffContext): Promise<LoyaltyCardView> {
    const [card, members, active30d, rule] = await Promise.all([
      this.prisma.loyalty_cards.findUnique({
        where: { vendor_id: ctx.vendorId },
        include: {
          live_version: true,
          versions: {
            orderBy: { number: 'desc' },
            select: {
              id: true, number: true, created_at: true,
              staff_users: { select: { name: true } }, platform_admins: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.cards.count({ where: { vendor_id: ctx.vendorId } }),
      this.prisma.cards.count({ where: { vendor_id: ctx.vendorId, last_activity_at: { gte: new Date(Date.now() - 30 * DAY) } } }),
      this.prisma.point_rules.findFirst({ where: { vendor_id: ctx.vendorId, is_active: true } }),
    ]);
    const until = card ? restorableUntil(card.cancelled_at) : null;
    return {
      card: card && {
        id: card.id,
        name: card.name,
        status: card.status as CardStatus,
        cancelledAt: card.cancelled_at?.toISOString() ?? null,
        restorableUntil: until?.toISOString() ?? null,
        liveVersionId: card.live_version_id,
        createdAt: card.created_at.toISOString(),
      },
      design: card?.live_version ? readDesign(card.live_version.design, card.name) : null,
      versions: (card?.versions ?? []).map((v) => ({
        id: v.id,
        number: v.number,
        createdAt: v.created_at.toISOString(),
        createdBy: v.staff_users?.name ?? v.platform_admins?.name ?? null,
        live: v.id === card!.live_version_id,
      })),
      counts: { members, active30d },
      rule: rule && { spendAmount: rule.spend_amount.toFixed(2), pointsPerSpend: rule.points_per_spend },
      canCreate: !card || (card.status === 'cancelled' && until! <= new Date()),
    };
  }

  /** The funnel: a first card (or a new one once a cancelled card can't be restored any more). */
  async create(ctx: StaffContext, dto: CreateLoyaltyCardDto): Promise<LoyaltyCardView> {
    const design = this.cleanDesign(ctx, dto.design);
    await this.prisma.$transaction(async (tx) => {
      await this.lockVendor(tx, ctx.vendorId);
      const existing = await tx.loyalty_cards.findUnique({ where: { vendor_id: ctx.vendorId } });
      if (existing && !(existing.status === 'cancelled' && restorableUntil(existing.cancelled_at)! <= new Date()))
        throw new ConflictException({ code: 'card_exists' });
      const card = existing
        ? await tx.loyalty_cards.update({
            where: { id: existing.id },
            data: { name: dto.name.trim(), status: 'active', cancelled_at: null },
          })
        : await tx.loyalty_cards.create({ data: { vendor_id: ctx.vendorId, name: dto.name.trim() } });
      await this.addVersion(tx, ctx, card.id, design);
    });
    await this.publishRule(ctx, dto.spendAmount);
    return this.get(ctx);
  }

  /** Card settings: the name and how much money earns one point. */
  async updateSettings(ctx: StaffContext, dto: UpdateLoyaltyCardSettingsDto): Promise<LoyaltyCardView> {
    const card = await this.mustGet(ctx);
    if (dto.name !== undefined) {
      await this.prisma.$transaction([
        this.prisma.loyalty_cards.update({ where: { id: card.id }, data: { name: dto.name.trim() } }),
        this.touchVendor(ctx.vendorId),
      ]);
    }
    if (dto.spendAmount !== undefined) await this.publishRule(ctx, dto.spendAmount);
    return this.get(ctx);
  }

  /** Pause stops new sign-ups only; members keep earning and redeeming. */
  async setPaused(ctx: StaffContext, paused: boolean): Promise<LoyaltyCardView> {
    const card = await this.mustGet(ctx);
    if (card.status === 'cancelled') throw new ConflictException({ code: 'card_cancelled' });
    await this.setStatus(ctx, card.id, paused ? 'paused' : 'active', null);
    return this.get(ctx);
  }

  /** Cancel: no sign-ups, no earning or redeeming, passes inactive; restorable for 30 days. */
  async cancel(ctx: StaffContext): Promise<LoyaltyCardView> {
    const card = await this.mustGet(ctx);
    if (card.status !== 'cancelled') await this.setStatus(ctx, card.id, 'cancelled', new Date());
    return this.get(ctx);
  }

  async restore(ctx: StaffContext): Promise<LoyaltyCardView> {
    const card = await this.mustGet(ctx);
    if (card.status !== 'cancelled') return this.get(ctx);
    if (restorableUntil(card.cancelled_at)! <= new Date()) throw new ConflictException({ code: 'restore_expired' });
    await this.setStatus(ctx, card.id, 'active', null);
    return this.get(ctx);
  }

  /** Save the editor: a new version (number + 1) that goes live at once. */
  async saveVersion(ctx: StaffContext, input: unknown): Promise<LoyaltyCardView> {
    const design = this.cleanDesign(ctx, input);
    await this.checkBranch(ctx, design);
    await this.prisma.$transaction(async (tx) => {
      const card = await tx.loyalty_cards.findUnique({ where: { vendor_id: ctx.vendorId } });
      if (!card) throw new NotFoundException({ code: 'card_not_found' });
      await this.lockCard(tx, card.id);
      await this.addVersion(tx, ctx, card.id, design);
    });
    return this.get(ctx);
  }

  /** "Use this": make an older (or newer) version live again; no new version is made. */
  async makeLive(ctx: StaffContext, versionId: string): Promise<LoyaltyCardView> {
    const card = await this.mustGet(ctx);
    const version = await this.prisma.loyalty_card_versions.findFirst({ where: { id: versionId, card_id: card.id } });
    if (!version) throw new NotFoundException({ code: 'version_not_found' });
    await this.prisma.$transaction([
      this.prisma.loyalty_cards.update({ where: { id: card.id }, data: { live_version_id: version.id } }),
      this.touchVendor(ctx.vendorId),
    ]);
    return this.get(ctx);
  }

  /**
   * Upload a background image. It is only used once a version with it is saved; files are
   * kept (older versions may still show them), like every image a version points at.
   */
  async uploadBackground(ctx: StaffContext, file: Buffer): Promise<{ imageUrl: string; imagePath: string }> {
    await this.mustGet(ctx);
    const webp = await toWebp(file, 'card_background');
    const path = `${ctx.vendorId}/card/${newImageName()}`;
    await this.storage.upload(BUCKETS.vendors, path, webp, IMAGE_CONTENT_TYPE);
    return { imagePath: path, imageUrl: this.storage.publicUrl(BUCKETS.vendors, path) };
  }

  /** The card's members: every customer card at this merchant, newest first. */
  async members(ctx: StaffContext, q: MembersQueryDto) {
    const pageSize = 25;
    const page = q.page ?? 1;
    const search = q.search?.trim();
    const where: Prisma.cardsWhereInput = {
      vendor_id: ctx.vendorId,
      ...(ctx.branchId ? { point_events: { some: { branch_id: ctx.branchId } } } : {}),
      ...(search
        ? {
            OR: [
              { users: { name: { contains: search, mode: 'insensitive' } } },
              { users: { email: { contains: search, mode: 'insensitive' } } },
              { users: { phone: { contains: search.replace(/\s/g, '') } } },
              { short_code: { contains: search.toUpperCase() } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.cards.count({ where }),
      this.prisma.cards.findMany({
        where,
        orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, short_code: true, balance: true, created_at: true,
          users: { select: { name: true, email: true, phone: true } },
        },
      }),
    ]);
    return {
      total,
      page,
      pageSize,
      items: rows.map((c) => ({
        id: c.id,
        name: c.users.name,
        email: c.users.email,
        phone: c.users.phone,
        code: c.short_code,
        joinedAt: c.created_at.toISOString(),
        // branch managers see their branch's members, not the merchant-wide balance
        points: ctx.branchId ? null : c.balance,
      })),
    };
  }

  // ---------------------------------------------------------------------------------------

  private async mustGet(ctx: StaffContext) {
    const card = await this.prisma.loyalty_cards.findUnique({ where: { vendor_id: ctx.vendorId } });
    if (!card) throw new NotFoundException({ code: 'card_not_found' });
    return card;
  }

  /** The background image must be one of this merchant's own uploads; its link is rebuilt. */
  private cleanDesign(ctx: StaffContext, input: unknown): CardDesign {
    const design = checkDesign(input);
    const path = design.background.imagePath;
    if (path) {
      if (!path.startsWith(`${ctx.vendorId}/card/`) || path.includes('..'))
        throw new ForbiddenException({ code: 'invalid_design', message: 'unknown background image' });
      design.background.imageUrl = this.storage.publicUrl(BUCKETS.vendors, path);
    }
    return design;
  }

  /** Directions must point at one of the merchant's open branches with a map pin. */
  private async checkBranch(ctx: StaffContext, design: CardDesign) {
    const s = design.buttons.secondary;
    if (s.type !== 'directions') return;
    const found = await this.prisma.branches.findFirst({
      where: { id: s.branchId, vendor_id: ctx.vendorId, status: 'active' },
      select: { id: true },
    });
    if (!found) throw new ConflictException({ code: 'invalid_branch' });
  }

  private async addVersion(tx: Prisma.TransactionClient, ctx: StaffContext, cardId: string, design: CardDesign) {
    const last = await tx.loyalty_card_versions.aggregate({ where: { card_id: cardId }, _max: { number: true } });
    const version = await tx.loyalty_card_versions.create({
      data: {
        card_id: cardId,
        vendor_id: ctx.vendorId,
        number: (last._max.number ?? 0) + 1,
        design: design as unknown as Prisma.InputJsonValue,
        created_by_staff_id: ctx.adminId ? null : ctx.staffId,
        created_by_admin_id: ctx.adminId ?? null,
      },
    });
    await tx.loyalty_cards.update({ where: { id: cardId }, data: { live_version_id: version.id } });
    await tx.vendors.update({ where: { id: ctx.vendorId }, data: { updated_at: new Date() } });
  }

  private async setStatus(ctx: StaffContext, cardId: string, status: CardStatus, cancelledAt: Date | null) {
    await this.prisma.$transaction([
      this.prisma.loyalty_cards.update({ where: { id: cardId }, data: { status, cancelled_at: cancelledAt } }),
      this.touchVendor(ctx.vendorId),
    ]);
  }

  private async publishRule(ctx: StaffContext, spendAmount: number) {
    const active = await this.prisma.point_rules.findFirst({ where: { vendor_id: ctx.vendorId, is_active: true } });
    if (active && Number(active.spend_amount) === spendAmount && active.points_per_spend === 1) return;
    await this.rules.publish(
      ctx.vendorId,
      {
        spendAmount,
        pointsPerSpend: 1,
        minPurchase: active ? Number(active.min_purchase) : 0,
        maxPointsPerPurchase: active?.max_points_per_purchase ?? null,
      },
      ctx.adminId ? null : ctx.staffId,
    );
  }

  /** The pass shows the card: a newer merchant timestamp makes the wallet sync re-send it. */
  private touchVendor(vendorId: string) {
    return this.prisma.vendors.update({ where: { id: vendorId }, data: { updated_at: new Date() } });
  }

  /** One card per merchant: creating takes the merchant row lock (two tabs can't both create). */
  private async lockVendor(tx: Prisma.TransactionClient, vendorId: string) {
    await tx.$queryRaw`SELECT id FROM vendors WHERE id = ${vendorId}::uuid FOR UPDATE`;
  }

  /** Version numbers are taken one save at a time. */
  private async lockCard(tx: Prisma.TransactionClient, cardId: string) {
    await tx.$queryRaw`SELECT id FROM loyalty_cards WHERE id = ${cardId}::uuid FOR UPDATE`;
  }
}

/** The merchant's loyalty card. Reading: admins, managers, viewers; changing: merchant admins. */
@VendorApi('vendor: loyalty card')
@Controller('vendor/loyalty-card')
export class LoyaltyCardController {
  constructor(private readonly cards: LoyaltyCardsService) {}

  @Get()
  @StaffRoles('vendor_admin', 'branch_manager', 'viewer')
  @ApiOkResponse({ description: 'The card (or null), its live look, versions, counts and rule' })
  get(@CurrentStaff() ctx: StaffContext) {
    return this.cards.get(ctx);
  }

  @Post()
  @StaffRoles('vendor_admin')
  @ApiOkResponse({ description: '409 card_exists, 400 invalid_design' })
  create(@CurrentStaff() ctx: StaffContext, @Body() dto: CreateLoyaltyCardDto) {
    return this.cards.create(ctx, dto);
  }

  @Patch('settings')
  @StaffRoles('vendor_admin')
  @ApiOkResponse({ description: '404 card_not_found' })
  settings(@CurrentStaff() ctx: StaffContext, @Body() dto: UpdateLoyaltyCardSettingsDto) {
    return this.cards.updateSettings(ctx, dto);
  }

  @Post('pause')
  @HttpCode(200)
  @StaffRoles('vendor_admin')
  pause(@CurrentStaff() ctx: StaffContext) {
    return this.cards.setPaused(ctx, true);
  }

  @Post('resume')
  @HttpCode(200)
  @StaffRoles('vendor_admin')
  resume(@CurrentStaff() ctx: StaffContext) {
    return this.cards.setPaused(ctx, false);
  }

  @Post('cancel')
  @HttpCode(200)
  @StaffRoles('vendor_admin')
  cancel(@CurrentStaff() ctx: StaffContext) {
    return this.cards.cancel(ctx);
  }

  @Post('restore')
  @HttpCode(200)
  @StaffRoles('vendor_admin')
  @ApiOkResponse({ description: '409 restore_expired' })
  restore(@CurrentStaff() ctx: StaffContext) {
    return this.cards.restore(ctx);
  }

  @Post('versions')
  @StaffRoles('vendor_admin')
  @ApiOkResponse({ description: 'A new live version; 400 invalid_design, 409 invalid_branch' })
  save(@CurrentStaff() ctx: StaffContext, @Body() dto: SaveVersionDto) {
    return this.cards.saveVersion(ctx, dto.design);
  }

  @Post('versions/:id/live')
  @HttpCode(200)
  @StaffRoles('vendor_admin')
  @ApiOkResponse({ description: '404 version_not_found' })
  makeLive(@CurrentStaff() ctx: StaffContext, @Param('id', ParseUuidPipe) id: string) {
    return this.cards.makeLive(ctx, id);
  }

  @Put('background')
  @StaffRoles('vendor_admin')
  @ApiImageUpload()
  @ApiOkResponse({ description: '{imageUrl, imagePath}: put them in the design and save a version' })
  background(@CurrentStaff() ctx: StaffContext, @UploadedFile() file: Express.Multer.File) {
    return this.cards.uploadBackground(ctx, file.buffer);
  }

  @Get('members')
  @StaffRoles('vendor_admin', 'branch_manager', 'viewer')
  members(@CurrentStaff() ctx: StaffContext, @Query() q: MembersQueryDto) {
    return this.cards.members(ctx, q);
  }
}

@Module({
  imports: [AuthModule, PointRulesModule, StorageModule],
  controllers: [LoyaltyCardController],
  providers: [LoyaltyCardsService],
  exports: [LoyaltyCardsService],
})
export class LoyaltyCardsModule {}
