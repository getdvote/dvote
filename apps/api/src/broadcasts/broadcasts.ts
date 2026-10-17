import { BadRequestException, Body, ConflictException, Controller, Get, Injectable, Logger, Module, OnApplicationBootstrap, OnModuleDestroy, Patch, Post, ServiceUnavailableException } from '@nestjs/common';
import { IsBoolean, IsNotEmpty, IsString, Length, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
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
import { GoogleWalletService, WalletRequestError } from '../wallet/google-wallet.service';

class SendBroadcastDto extends CustomerListQuery {
  @ApiProperty() @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(80) @Matches(/^[^<>]*$/) title: string;
  @ApiProperty() @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(500) @Matches(/^[^<>]*$/) body: string;
  @ApiProperty() @IsString() @Length(8, 100) @Matches(/^[A-Za-z0-9_.:-]+$/) idempotencyKey: string;
}
class NearbyDto { @ApiProperty() @IsBoolean() enabled: boolean; }
type Campaign = { id: string; title: string; body: string; audience: unknown; createdAt: Date; total: number; pending: number; accepted: number; skipped: number; failed: number; unknown: number };

@Injectable()
export class BroadcastsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger(BroadcastsService.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private stopped = false;
  constructor(private readonly prisma: PrismaService, private readonly customers: MerchantCustomersService, private readonly google: GoogleWalletService) {}

  onApplicationBootstrap() {
    if (!this.google.enabled) return;
    this.timer = setInterval(() => this.kick(), 5_000);
    this.timer.unref();
    this.kick();
  }
  async onModuleDestroy() { this.stopped = true; clearInterval(this.timer); await this.running; }
  private kick() {
    if (this.running || this.stopped || !this.google.enabled) return;
    this.running = this.processPending().catch(() => this.log.warn('Broadcast worker failed; pending jobs will retry.')).finally(() => { this.running = undefined; });
  }

  async preview(ctx: StaffContext, q: CustomerListQuery) {
    const cards = await this.customers.broadcastAudience(ctx, q);
    return { matched: cards.length, linked: cards.filter(c => c.google_object_id).length, unavailable: cards.filter(c => !c.google_object_id).length, configured: this.google.enabled };
  }

  async send(ctx: StaffContext, dto: SendBroadcastDto) {
    if (!this.google.enabled) throw new ServiceUnavailableException({ code: 'wallet_not_configured' });
    const audience = { segment: dto.segment, customSegment: dto.customSegment, branchId: dto.branchId, search: dto.search };
    const previous = await this.prisma.$queryRaw<{ id: string; title: string; body: string; audience: unknown }[]>`
      SELECT id,title,body,audience FROM wallet_broadcasts WHERE vendor_id=${ctx.vendorId}::uuid AND idempotency_key=${dto.idempotencyKey}`;
    if (previous.length) {
      const old = previous[0];
      const sameAudience = Object.entries(audience).every(([key, value]) => (old.audience as Record<string, unknown>)[key] === value);
      if (old.title !== dto.title || old.body !== dto.body || !sameAudience) throw new ConflictException({ code: 'idempotency_key_reused' });
      return { id: old.id };
    }
    const cards = (await this.customers.broadcastAudience(ctx, dto)).filter(c => c.google_object_id);
    if (!cards.length) throw new BadRequestException({ code: 'broadcast_empty' });
    if (cards.length > 20000) throw new BadRequestException({ code: 'broadcast_too_large' });
    const id = await this.prisma.$transaction(async tx => {
      const [row] = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO wallet_broadcasts(vendor_id,created_by,title,body,audience,idempotency_key)
        VALUES(${ctx.vendorId}::uuid,${ctx.staffId}::uuid,${dto.title},${dto.body},${JSON.stringify(audience)}::jsonb,${dto.idempotencyKey})
        ON CONFLICT(vendor_id,idempotency_key) DO NOTHING RETURNING id`;
      if (!row) throw new ConflictException({ code: 'broadcast_submit_in_progress' });
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
      WHERE b.vendor_id=${ctx.vendorId}::uuid AND b.audience->>'type' IS DISTINCT FROM 'redemption'
      GROUP BY b.id ORDER BY b.created_at DESC LIMIT 30`;
  }

  async nearby(ctx: StaffContext) {
    const [row] = await this.prisma.$queryRaw<{ enabled: boolean; locations: number }[]>`
      SELECT v.wallet_nearby_enabled AS enabled,(SELECT count(*)::int FROM branches b WHERE b.vendor_id=v.id AND b.status='active' AND b.lat IS NOT NULL AND b.lng IS NOT NULL) AS locations
      FROM vendors v WHERE v.id=${ctx.vendorId}::uuid`;
    return row;
  }
  async setNearby(ctx: StaffContext, enabled: boolean) {
    await this.prisma.$executeRaw`UPDATE vendors SET wallet_nearby_enabled=${enabled} WHERE id=${ctx.vendorId}::uuid`;
    this.google.vendorChanged(ctx.vendorId);
    return this.nearby(ctx);
  }

  /** Accepted means Google accepted the request, never proof of device delivery. */
  async processPending(): Promise<void> {
    if (!this.google.enabled || this.stopped) return;
    // Never blindly resend an ambiguous network operation following a crash.
    await this.prisma.$executeRaw`UPDATE wallet_broadcast_recipients SET status='unknown',reason='interrupted' WHERE status='processing' AND attempted_at < now()-interval '2 minutes'`;
    for (let i = 0; i < 20 && !this.stopped; i++) {
      const rows = await this.prisma.$queryRaw<{ id: string; card_id: string; vendor_id: string; broadcast_id: string; google_object_id: string }[]>`
        UPDATE wallet_broadcast_recipients r SET status='processing',attempted_at=now()
        WHERE r.id=(SELECT id FROM wallet_broadcast_recipients WHERE status='pending' ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1)
        RETURNING r.id,r.card_id,r.vendor_id,r.broadcast_id,r.google_object_id`;
      if (!rows.length) break;
      const row = rows[0];
      try {
        const [eligible] = await this.prisma.$queryRaw<{ active: boolean; title: string; body: string; quota: number }[]>`
          SELECT (u.status='active' AND v.status='active' AND c.google_object_id=${row.google_object_id}) AS active,b.title,b.body,
            (SELECT count(*)::int FROM wallet_broadcast_recipients WHERE card_id=c.id AND status IN ('processing','accepted','unknown') AND attempted_at > now()-interval '24 hours') AS quota
          FROM cards c JOIN users u ON u.id=c.user_id JOIN vendors v ON v.id=c.vendor_id
          JOIN wallet_broadcasts b ON b.id=${row.broadcast_id}::uuid AND b.vendor_id=c.vendor_id
          WHERE c.id=${row.card_id}::uuid AND c.vendor_id=${row.vendor_id}::uuid`;
        const result = !eligible?.active ? { status: 'skipped', reason: 'inactive' }
          : eligible.quota > 3 ? { status: 'skipped', reason: 'daily_limit' }
          : await this.google.notifyCard(row.google_object_id, `dvote-broadcast-${row.broadcast_id}`, eligible.title, eligible.body);
        await this.prisma.$executeRaw`UPDATE wallet_broadcast_recipients SET status=${result.status},reason=${result.reason} WHERE id=${row.id}::uuid`;
      } catch (error) {
        // A definite Google rejection did not send a notification. Reserve quota only
        // for accepted or ambiguous requests, rather than counting HTTP 400 as a send.
        const rejected = error instanceof WalletRequestError && error.httpStatus >= 400 && error.httpStatus < 500;
        const status = rejected ? 'failed' : 'unknown';
        const reason = rejected ? `provider_http_${error.httpStatus}` : 'provider_error';
        this.log.warn(`Wallet message ${row.id}: ${error instanceof WalletRequestError ? error.message : 'delivery outcome unknown (network or internal error)'}`);
        await this.prisma.$executeRaw`UPDATE wallet_broadcast_recipients SET status=${status},reason=${reason} WHERE id=${row.id}::uuid`;
      }
    }
  }
}

@VendorApi('vendor: broadcasts')
@StaffRoles('vendor_admin')
@Controller('vendor/broadcasts')
export class BroadcastsController {
  constructor(private readonly service: BroadcastsService) {}
  @Get() history(@CurrentStaff() ctx: StaffContext) { return this.service.history(ctx); }
  @Post('preview') preview(@CurrentStaff() ctx: StaffContext, @Body() dto: CustomerListQuery) { return this.service.preview(ctx, dto); }
  @Post() send(@CurrentStaff() ctx: StaffContext, @Body() dto: SendBroadcastDto) { return this.service.send(ctx, dto); }
  @Get('nearby') nearby(@CurrentStaff() ctx: StaffContext) { return this.service.nearby(ctx); }
  @Patch('nearby') setNearby(@CurrentStaff() ctx: StaffContext, @Body() dto: NearbyDto) { return this.service.setNearby(ctx, dto.enabled); }
}

@Module({ imports: [AuthModule, WalletModule, MerchantCustomersModule], controllers: [BroadcastsController], providers: [BroadcastsService] })
export class BroadcastsModule {}
