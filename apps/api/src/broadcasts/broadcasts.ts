import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Logger,
  Module,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Patch,
  Param,
  NotFoundException,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  IsBoolean,
  IsOptional,
  IsIn,
  IsInt,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
  validate,
} from 'class-validator';
import { Transform, plainToInstance } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AuthModule } from '../auth/auth.module';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffRoles, type StaffContext } from '../auth/staff-auth.guard';
import { VendorApi } from '../auth/vendor-api.decorator';
import { CustomerListQuery } from '../merchant-customers/customer.dto';
import { MerchantCustomersModule } from '../merchant-customers/merchant-customers.module';
import { MerchantCustomersService } from '../merchant-customers/merchant-customers.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletModule } from '../wallet/wallet.module';
import {
  GoogleWalletService,
  WalletRequestError,
} from '../wallet/google-wallet.service';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);
/** Wallet text is shown as plain text; refuse markup-like input everywhere it can come from. */
const NO_MARKUP = /^[^<>]*$/;

export class SendBroadcastDto extends CustomerListQuery {
  @ApiProperty()
  @trim
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Matches(NO_MARKUP)
  title: string;
  @ApiProperty()
  @trim
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  @Matches(NO_MARKUP)
  body: string;
  @ApiProperty()
  @IsString()
  @Length(8, 100)
  @Matches(/^[A-Za-z0-9_.:-]+$/)
  idempotencyKey: string;
}
class NearbyDto {
  @ApiProperty() @IsBoolean() enabled: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) branchIds?: string[];
}
export class CampaignDto extends CustomerListQuery {
  @IsOptional()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  clientDraftId?: string;
  @IsOptional() @IsIn(['now', 'schedule', 'repeat']) draftMode?: string;
  @trim @IsString() @Length(1, 80) @Matches(NO_MARKUP) name: string;
  // Drafts may be saved with an empty body; a send still requires one (saveCampaign).
  @trim @IsString() @MaxLength(2000) @Matches(NO_MARKUP) body: string;
  @IsIn(['draft', 'now', 'schedule', 'repeat']) mode:
    'draft' | 'now' | 'schedule' | 'repeat';
  @IsOptional() @IsDateString() nextAt?: string;
  @IsOptional() @IsInt() @IsIn([1, 7, 30]) repeatDays?: number;
}
type SavedCampaign = {
  id: string;
  name: string;
  body: string;
  audience: CustomerListQuery;
  status: string;
  nextAt: Date | null;
  repeatDays: number | null;
  createdAt: Date;
  actor: StaffContext;
  accepted?: number;
};
type Campaign = {
  id: string;
  title: string;
  body: string;
  audience: unknown;
  createdAt: Date;
  total: number;
  pending: number;
  accepted: number;
  skipped: number;
  failed: number;
  unknown: number;
};

@Injectable()
export class BroadcastsService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly log = new Logger(BroadcastsService.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private stopped = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: MerchantCustomersService,
    private readonly google: GoogleWalletService,
  ) {}

  onApplicationBootstrap() {
    // tests run the worker themselves (processPending), scoped to their own shop
    if (!this.google.enabled || process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => this.kick(), 5_000);
    this.timer.unref();
    this.kick();
  }
  async onModuleDestroy() {
    this.stopped = true;
    clearInterval(this.timer);
    await this.running;
  }
  private kick() {
    if (
      this.running ||
      this.stopped ||
      !this.google.enabled ||
      process.env.NODE_ENV === 'test'
    )
      return;
    this.running = this.processPending()
      .catch(() =>
        this.log.warn('Broadcast worker failed; pending jobs will retry.'),
      )
      .finally(() => {
        this.running = undefined;
      });
  }

  async preview(ctx: StaffContext, q: CustomerListQuery) {
    const cards = await this.customers.broadcastAudience(ctx, q);
    return {
      matched: cards.length,
      linked: cards.filter((c) => c.google_object_id).length,
      unavailable: cards.filter((c) => !c.google_object_id).length,
      configured: this.google.enabled,
    };
  }

  async send(ctx: StaffContext, dto: SendBroadcastDto, campaignId?: string) {
    if (!this.google.enabled)
      throw new ServiceUnavailableException({ code: 'wallet_not_configured' });
    const audience = {
      ...(campaignId ? { campaignId } : {}),
      segment: dto.segment,
      customSegment: dto.customSegment,
      branchId: dto.branchId,
      search: dto.search,
    };
    const previous = await this.prisma.$queryRaw<
      { id: string; title: string; body: string; audience: unknown }[]
    >`
      SELECT id,title,body,audience FROM wallet_broadcasts WHERE vendor_id=${ctx.vendorId}::uuid AND idempotency_key=${dto.idempotencyKey}`;
    if (previous.length) {
      const old = previous[0];
      const sameAudience = Object.entries(audience).every(
        ([key, value]) =>
          (old.audience as Record<string, unknown>)[key] === value,
      );
      if (old.title !== dto.title || old.body !== dto.body || !sameAudience)
        throw new ConflictException({ code: 'idempotency_key_reused' });
      return { id: old.id };
    }
    const cards = (await this.customers.broadcastAudience(ctx, dto)).filter(
      (c) => c.google_object_id,
    );
    if (!cards.length)
      throw new BadRequestException({ code: 'broadcast_empty' });
    if (cards.length > 20000)
      throw new BadRequestException({ code: 'broadcast_too_large' });
    const id = await this.prisma.$transaction(async (tx) => {
      if (campaignId) {
        // Serialize submissions for this merchant so two workers cannot reserve the last slot.
        await tx.$queryRaw`SELECT id FROM vendors WHERE id=${ctx.vendorId}::uuid FOR UPDATE`;
        const [quota] = await tx.$queryRaw<{ used: number; nearby: boolean }[]>`
          SELECT (SELECT count(*)::int FROM wallet_broadcasts b WHERE b.vendor_id=v.id AND b.created_at>now()-interval '24 hours'
          AND EXISTS(SELECT 1 FROM wallet_broadcast_recipients r WHERE r.broadcast_id=b.id AND r.status IN ('pending','processing','accepted','unknown'))) AS used,
          v.wallet_nearby_enabled AS nearby FROM vendors v WHERE v.id=${ctx.vendorId}::uuid`;
        if (quota.used >= (quota.nearby ? 2 : 3))
          throw new ConflictException({ code: 'broadcast_daily_limit' });
      }
      const [row] = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO wallet_broadcasts(vendor_id,created_by,created_by_admin_id,title,body,audience,idempotency_key)
        VALUES(${ctx.vendorId}::uuid,${ctx.adminId ? null : ctx.staffId}::uuid,${ctx.adminId ?? null}::uuid,${dto.title},${dto.body},${JSON.stringify(audience)}::jsonb,${dto.idempotencyKey})
        ON CONFLICT(vendor_id,idempotency_key) DO NOTHING RETURNING id`;
      if (!row)
        throw new ConflictException({ code: 'broadcast_submit_in_progress' });
      // One immutable audience snapshot; later segment edits cannot expand a queued send.
      await tx.$executeRaw`
        INSERT INTO wallet_broadcast_recipients(broadcast_id,vendor_id,card_id,google_object_id)
        SELECT ${row.id}::uuid,${ctx.vendorId}::uuid,x.id::uuid,x.google_object_id
        FROM jsonb_to_recordset(${JSON.stringify(cards)}::jsonb) AS x(id text,google_object_id text)`;
      return row.id;
    });
    this.kick();
    return { id };
  }

  history(ctx: StaffContext): Promise<Campaign[]> {
    return this.prisma.$queryRaw<Campaign[]>`
      SELECT b.id,b.title,b.body,b.audience,b.created_at AS "createdAt",count(r.id)::int AS total,
        count(*) FILTER(WHERE r.status IN ('pending','processing'))::int AS pending,
        count(*) FILTER(WHERE r.status='accepted')::int AS accepted,
        count(*) FILTER(WHERE r.status='skipped')::int AS skipped,
        count(*) FILTER(WHERE r.status='failed')::int AS failed,
        count(*) FILTER(WHERE r.status='unknown')::int AS unknown
      FROM wallet_broadcasts b LEFT JOIN wallet_broadcast_recipients r ON r.broadcast_id=b.id
      WHERE b.vendor_id=${ctx.vendorId}::uuid AND b.audience->>'type' IS DISTINCT FROM 'redemption' AND b.audience->>'campaignId' IS NULL
      GROUP BY b.id ORDER BY b.created_at DESC LIMIT 30`;
  }

  async nearby(ctx: StaffContext) {
    const [row] = await this.prisma.$queryRaw<
      { enabled: boolean; locations: number; branchIds: string[] | null }[]
    >`
      SELECT v.wallet_nearby_enabled AS enabled,v.wallet_nearby_branch_ids AS "branchIds",(SELECT count(*)::int FROM branches b WHERE b.vendor_id=v.id AND b.status='active' AND b.lat IS NOT NULL AND b.lng IS NOT NULL) AS locations
      FROM vendors v WHERE v.id=${ctx.vendorId}::uuid`;
    return row;
  }
  async setNearby(ctx: StaffContext, enabled: boolean, branchIds?: string[]) {
    if (branchIds) {
      const valid = await this.prisma.branches.findMany({
        where: {
          vendor_id: ctx.vendorId,
          status: 'active',
          lat: { not: null },
          lng: { not: null },
        },
        select: { id: true },
      });
      if (
        branchIds.some((id) => !valid.some((b) => b.id === id)) ||
        (enabled && !branchIds.length) ||
        branchIds.length > 10
      )
        throw new BadRequestException({ code: 'nearby_invalid_branches' });
      await this.prisma
        .$executeRaw`UPDATE vendors SET wallet_nearby_branch_ids=ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(branchIds)}::jsonb)::uuid) WHERE id=${ctx.vendorId}::uuid`;
    }
    await this.prisma
      .$executeRaw`UPDATE vendors SET wallet_nearby_enabled=${enabled} WHERE id=${ctx.vendorId}::uuid`;
    this.google.vendorChanged(ctx.vendorId);
    return this.nearby(ctx);
  }

  async quota(ctx: StaffContext) {
    const [row] = await this.prisma.$queryRaw<
      { used: number; nearby: boolean; resetsAt: Date | null }[]
    >`
      SELECT LEAST(3,count(DISTINCT b.id)::int) AS used,
      (SELECT wallet_nearby_enabled FROM vendors WHERE id=${ctx.vendorId}::uuid) AS nearby,
      min(b.created_at)+interval '24 hours' AS "resetsAt"
      FROM wallet_broadcasts b WHERE b.vendor_id=${ctx.vendorId}::uuid
      AND b.created_at > now()-interval '24 hours'
      AND EXISTS(SELECT 1 FROM wallet_broadcast_recipients r WHERE r.broadcast_id=b.id AND r.status IN ('pending','processing','accepted','unknown'))`;
    return {
      ...row,
      remaining: Math.max(0, 3 - row.used - (row.nearby ? 1 : 0)),
    };
  }

  campaigns(ctx: StaffContext) {
    return this.prisma.$queryRaw<SavedCampaign[]>`
      SELECT c.id,c.name,c.body,c.audience,c.status,
        CASE WHEN c.status='sent' AND EXISTS(SELECT 1 FROM wallet_broadcast_recipients r JOIN wallet_broadcasts b ON b.id=r.broadcast_id WHERE b.audience->>'campaignId'=c.id::text AND r.status IN ('pending','processing')) THEN 'processing'
        WHEN c.status='sent' AND EXISTS(SELECT 1 FROM wallet_broadcast_recipients r JOIN wallet_broadcasts b ON b.id=r.broadcast_id WHERE b.audience->>'campaignId'=c.id::text AND r.status IN ('failed','unknown')) THEN 'failed'
        ELSE NULL END AS "deliveryStatus",c.next_at AS "nextAt",c.repeat_days AS "repeatDays",COALESCE((SELECT max(created_at) FROM wallet_broadcasts WHERE audience->>'campaignId'=c.id::text),c.created_at) AS "createdAt",
        (SELECT count(*)::int FROM wallet_broadcast_recipients r JOIN wallet_broadcasts b ON b.id=r.broadcast_id WHERE b.id=(SELECT id FROM wallet_broadcasts WHERE audience->>'campaignId'=c.id::text ORDER BY created_at DESC LIMIT 1) AND r.status='accepted') AS accepted
      FROM wallet_campaigns c WHERE c.vendor_id=${ctx.vendorId}::uuid ORDER BY c.created_at DESC LIMIT 100`;
  }

  async saveCampaign(ctx: StaffContext, dto: CampaignDto, id?: string) {
    if (!dto.name.trim() || (dto.mode !== 'draft' && !dto.body.trim()))
      throw new BadRequestException({ code: 'campaign_content_required' });
    if (
      dto.mode !== 'draft' &&
      dto.mode !== 'now' &&
      (!dto.nextAt || new Date(dto.nextAt).getTime() <= Date.now())
    )
      throw new BadRequestException({ code: 'campaign_future_required' });
    if (dto.mode === 'repeat' && !dto.repeatDays)
      throw new BadRequestException({ code: 'campaign_repeat_required' });
    const audience = {
      ...(dto.mode === 'draft'
        ? {
            draftMode: dto.draftMode,
            draftNextAt: dto.nextAt,
            draftRepeatDays: dto.repeatDays,
          }
        : {}),
      segment: dto.segment,
      customSegment: dto.customSegment,
      branchId: dto.branchId,
    };
    if (dto.mode === 'now' && (await this.quota(ctx)).remaining === 0)
      throw new ConflictException({ code: 'broadcast_daily_limit' });
    if (dto.mode !== 'draft') {
      if (!this.google.enabled)
        throw new ServiceUnavailableException({
          code: 'wallet_not_configured',
        });
      const preview = await this.preview(ctx, dto);
      if (!preview.linked)
        throw new BadRequestException({ code: 'broadcast_empty' });
    }
    const status =
      dto.mode === 'draft'
        ? 'draft'
        : dto.mode === 'repeat'
          ? 'repeating'
          : 'scheduled';
    const next =
      dto.mode === 'draft'
        ? null
        : dto.mode === 'now'
          ? new Date()
          : new Date(dto.nextAt!);
    const rows = id
      ? await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE wallet_campaigns SET name=${dto.name.trim()},body=${dto.body.trim()},audience=${JSON.stringify(audience)}::jsonb,
      status=${status},next_at=${next},repeat_days=${dto.mode === 'repeat' ? dto.repeatDays! : null},updated_at=now()
      WHERE id::text=${id} AND vendor_id=${ctx.vendorId}::uuid AND status IN ('draft','scheduled','repeating','failed') RETURNING id`
      : await this.prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO wallet_campaigns(id,vendor_id,actor,name,body,audience,status,next_at,repeat_days)
      VALUES(COALESCE(${dto.clientDraftId ?? null}::uuid,gen_random_uuid()),${ctx.vendorId}::uuid,${JSON.stringify(ctx)}::jsonb,${dto.name.trim()},${dto.body.trim()},${JSON.stringify(audience)}::jsonb,${status},${next},${dto.mode === 'repeat' ? dto.repeatDays! : null})
      ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,body=EXCLUDED.body,audience=EXCLUDED.audience,updated_at=now()
      WHERE wallet_campaigns.vendor_id=EXCLUDED.vendor_id AND wallet_campaigns.status='draft' AND EXCLUDED.status='draft'
      RETURNING id`;
    if (!rows.length)
      throw new NotFoundException({ code: 'campaign_not_editable' });
    if (dto.mode !== 'draft') this.kick();
    return rows[0];
  }

  async cancelCampaign(ctx: StaffContext, id: string) {
    const n = await this.prisma
      .$executeRaw`UPDATE wallet_campaigns SET status='cancelled',next_at=NULL,updated_at=now() WHERE id::text=${id} AND vendor_id=${ctx.vendorId}::uuid AND status IN ('draft','scheduled','repeating','failed')`;
    if (!n) throw new NotFoundException({ code: 'campaign_not_editable' });
    return { id };
  }

  /**
   * Stored rows are re-checked with the same rules as a direct send before they go out:
   * a row written before a rule existed, or edited in the database, must not bypass them.
   */
  private async storedSend(c: SavedCampaign, idempotencyKey: string) {
    const { segment, customSegment, branchId } = c.audience ?? {};
    const dto = plainToInstance(SendBroadcastDto, {
      segment,
      customSegment,
      branchId,
      title: c.name,
      body: c.body,
      idempotencyKey,
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length)
      throw new BadRequestException({ code: 'campaign_invalid' });
    return dto;
  }

  private async processCampaigns(vendorId?: string) {
    if (!this.google.enabled) return;
    for (let i = 0; i < 10; i++) {
      const [c] = await this.prisma.$queryRaw<SavedCampaign[]>`
        UPDATE wallet_campaigns SET status='processing',updated_at=now() WHERE id=(
          SELECT id FROM wallet_campaigns WHERE next_at<=now()
          AND (status IN ('scheduled','repeating') OR (status='processing' AND updated_at<now()-interval '5 minutes'))
          AND (${vendorId ?? null}::uuid IS NULL OR vendor_id=${vendorId ?? null}::uuid)
          ORDER BY next_at FOR UPDATE SKIP LOCKED LIMIT 1)
        RETURNING id,name,body,audience,actor,next_at AS "nextAt",repeat_days AS "repeatDays"`;
      if (!c) break;
      try {
        // Same occurrence key on recovery: a crash cannot create a second broadcast.
        const dto = await this.storedSend(
          c,
          `campaign:${c.id}:${new Date(c.nextAt!).getTime()}`,
        );
        await this.send(c.actor, dto, c.id);
        const next = c.repeatDays
          ? new Date(
              Math.max(Date.now(), new Date(c.nextAt!).getTime()) +
                c.repeatDays * 86400000,
            )
          : null;
        await this.prisma
          .$executeRaw`UPDATE wallet_campaigns SET status=${next ? 'repeating' : 'sent'},next_at=${next},updated_at=now() WHERE id=${c.id}::uuid`;
      } catch (error) {
        if (
          error instanceof ConflictException &&
          (error.getResponse() as { code?: string }).code ===
            'broadcast_daily_limit'
        ) {
          await this.prisma
            .$executeRaw`UPDATE wallet_campaigns SET status=${c.repeatDays ? 'repeating' : 'scheduled'},next_at=now()+interval '5 minutes',updated_at=now() WHERE id=${c.id}::uuid`;
          continue;
        }
        await this.prisma
          .$executeRaw`UPDATE wallet_campaigns SET status='failed',updated_at=now() WHERE id=${c.id}::uuid`;
        this.log.warn(
          `Campaign ${c.id} could not be queued; merchant review required.`,
        );
      }
    }
  }

  /**
   * Accepted means Google accepted the request, never proof of device delivery.
   * `onlyVendorId` limits the run to one shop (tests share one database across parallel files);
   * the API's own worker passes nothing and serves every shop.
   */
  async processPending(onlyVendorId?: string): Promise<void> {
    await this.processCampaigns(onlyVendorId);
    const vendor = onlyVendorId ?? null;
    if (!this.google.enabled || this.stopped) return;
    // Never blindly resend an ambiguous network operation following a crash.
    await this.prisma
      .$executeRaw`UPDATE wallet_broadcast_recipients SET status='unknown',reason='interrupted' WHERE status='processing' AND attempted_at < now()-interval '2 minutes' AND (${vendor}::uuid IS NULL OR vendor_id=${vendor}::uuid)`;
    for (let i = 0; i < 20 && !this.stopped; i++) {
      const rows = await this.prisma.$queryRaw<
        {
          id: string;
          card_id: string;
          vendor_id: string;
          broadcast_id: string;
          google_object_id: string;
        }[]
      >`
        UPDATE wallet_broadcast_recipients r SET status='processing',attempted_at=now()
        WHERE r.id=(SELECT id FROM wallet_broadcast_recipients WHERE status='pending' AND (${vendor}::uuid IS NULL OR vendor_id=${vendor}::uuid) ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1)
        RETURNING r.id,r.card_id,r.vendor_id,r.broadcast_id,r.google_object_id`;
      if (!rows.length) break;
      const row = rows[0];
      try {
        const [eligible] = await this.prisma.$queryRaw<
          {
            active: boolean;
            title: string;
            body: string;
            quota: number;
            nearby: boolean;
          }[]
        >`
          SELECT (u.status='active' AND v.status='active' AND c.google_object_id=${row.google_object_id}) AS active,v.wallet_nearby_enabled AS nearby,CASE WHEN b.audience->>'type'='redemption' THEN b.title ELSE v.name END AS title,b.body,
            (SELECT count(*)::int FROM wallet_broadcast_recipients WHERE card_id=c.id AND status IN ('processing','accepted','unknown') AND attempted_at > now()-interval '24 hours') AS quota
          FROM cards c JOIN users u ON u.id=c.user_id JOIN vendors v ON v.id=c.vendor_id
          JOIN wallet_broadcasts b ON b.id=${row.broadcast_id}::uuid AND b.vendor_id=c.vendor_id
          WHERE c.id=${row.card_id}::uuid AND c.vendor_id=${row.vendor_id}::uuid`;
        const result = !eligible?.active
          ? { status: 'skipped', reason: 'inactive' }
          : eligible.quota > (eligible.nearby ? 2 : 3)
            ? { status: 'skipped', reason: 'daily_limit' }
            : await this.google.notifyCard(
                row.google_object_id,
                `dvote-broadcast-${row.broadcast_id}`,
                eligible.title,
                eligible.body,
              );
        await this.prisma
          .$executeRaw`UPDATE wallet_broadcast_recipients SET status=${result.status},reason=${result.reason} WHERE id=${row.id}::uuid`;
      } catch (error) {
        // A definite Google rejection did not send a notification. Reserve quota only
        // for accepted or ambiguous requests, rather than counting HTTP 400 as a send.
        const rejected =
          error instanceof WalletRequestError &&
          error.httpStatus >= 400 &&
          error.httpStatus < 500;
        const status = rejected ? 'failed' : 'unknown';
        const reason = rejected
          ? `provider_http_${error.httpStatus}`
          : 'provider_error';
        this.log.warn(
          `Wallet message ${row.id}: ${error instanceof WalletRequestError ? error.message : 'delivery outcome unknown (network or internal error)'}`,
        );
        await this.prisma
          .$executeRaw`UPDATE wallet_broadcast_recipients SET status=${status},reason=${reason} WHERE id=${row.id}::uuid`;
      }
    }
  }
}

@VendorApi('vendor: broadcasts')
@StaffRoles('vendor_admin')
@Controller('vendor/broadcasts')
export class BroadcastsController {
  constructor(private readonly service: BroadcastsService) {}
  @Get() history(@CurrentStaff() ctx: StaffContext) {
    return this.service.history(ctx);
  }
  @Post('preview') preview(
    @CurrentStaff() ctx: StaffContext,
    @Body() dto: CustomerListQuery,
  ) {
    return this.service.preview(ctx, dto);
  }
  @Post() send(
    @CurrentStaff() ctx: StaffContext,
    @Body() dto: SendBroadcastDto,
  ) {
    return this.service.send(ctx, dto);
  }
  @Get('quota') quota(@CurrentStaff() ctx: StaffContext) {
    return this.service.quota(ctx);
  }
  @Get('campaigns') campaigns(@CurrentStaff() ctx: StaffContext) {
    return this.service.campaigns(ctx);
  }
  @Post('campaigns') createCampaign(
    @CurrentStaff() ctx: StaffContext,
    @Body() dto: CampaignDto,
  ) {
    return this.service.saveCampaign(ctx, dto);
  }
  @Patch('campaigns/:id') updateCampaign(
    @CurrentStaff() ctx: StaffContext,
    @Param('id') id: string,
    @Body() dto: CampaignDto,
  ) {
    return this.service.saveCampaign(ctx, dto, id);
  }
  @Post('campaigns/:id/cancel') cancelCampaign(
    @CurrentStaff() ctx: StaffContext,
    @Param('id') id: string,
  ) {
    return this.service.cancelCampaign(ctx, id);
  }
  @Get('nearby') nearby(@CurrentStaff() ctx: StaffContext) {
    return this.service.nearby(ctx);
  }
  @Patch('nearby') setNearby(
    @CurrentStaff() ctx: StaffContext,
    @Body() dto: NearbyDto,
  ) {
    return this.service.setNearby(ctx, dto.enabled, dto.branchIds);
  }
}

@Module({
  imports: [AuthModule, WalletModule, MerchantCustomersModule],
  controllers: [BroadcastsController],
  providers: [BroadcastsService],
  exports: [BroadcastsService],
})
export class BroadcastsModule {}
