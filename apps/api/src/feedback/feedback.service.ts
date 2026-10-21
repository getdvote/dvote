import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { StaffContext } from '../auth/staff-auth.guard';
import { Env } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import {
  FEEDBACK_CATEGORIES,
  MERCHANT_MOODS,
  type CreateFeedbackDto,
  type MerchantFeedbackDto,
  type MerchantMood,
} from './dto/create-feedback.dto';
import type { ListMerchantFeedbackQueryDto, MerchantFeedbackListDto } from './dto/merchant-feedback-list.dto';

const SHEET_TIMEOUT_MS = 10_000;

/**
 * Sends customer and merchant feedback to the feedback Google Sheet through its Apps Script web app
 * (google-apps-script/feedback.gs). Merchant feedback is also stored (merchant_feedback) for admins.
 */
@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);
  private readonly url: string | undefined;
  private readonly secret: string | undefined;

  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    this.url = config.get('FEEDBACK_SHEET_URL', { infer: true });
    this.secret = config.get('FEEDBACK_SHEET_SECRET', { infer: true })?.trim();
  }

  async send(userId: string, dto: CreateFeedbackDto): Promise<void> {
    await this.write(userId, FEEDBACK_CATEGORIES[dto.category], dto.message);
  }

  /**
   * Quick feedback from the merchant dashboard: saved for the admin Feedback page, then copied to the
   * sheet when it is set up (a sheet failure is logged, never shown to the merchant).
   */
  async sendMerchant(ctx: StaffContext, dto: MerchantFeedbackDto): Promise<void> {
    const row = await this.prisma.merchant_feedback.create({
      data: { vendor_id: ctx.vendorId, staff_id: ctx.staffId, mood: dto.mood ?? null, message: dto.message },
      select: { staff_users: { select: { name: true, email: true } }, vendors: { select: { name: true } } },
    });
    if (!this.url || !this.secret) return;
    await this.write(
      `merchant · ${row.vendors.name} · ${row.staff_users.name} <${row.staff_users.email}> (${ctx.role})`,
      `Merchant feedback${dto.mood ? ` · ${MERCHANT_MOODS[dto.mood]}` : ''}`,
      dto.message,
    ).catch(() => undefined);
  }

  /** The admin Feedback page: newest first, with the shop and the team member who sent it. */
  async listMerchant(query: ListMerchantFeedbackQueryDto): Promise<MerchantFeedbackListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const scope = { vendor_id: query.vendorId };
    const where = { ...scope, mood: query.mood };
    const [total, rows, moods] = await Promise.all([
      this.prisma.merchant_feedback.count({ where }),
      this.prisma.merchant_feedback.findMany({
        where,
        include: {
          vendors: { select: { id: true, name: true, logo_url: true } },
          staff_users: { select: { name: true, email: true, role: true } },
        },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.merchant_feedback.groupBy({ by: ['mood'], where: scope, _count: { _all: true } }),
    ]);
    const count = (m: string | null) => moods.find((x) => x.mood === m)?._count._all ?? 0;
    return {
      items: rows.map((r) => ({
        id: r.id,
        createdAt: r.created_at.toISOString(),
        mood: (r.mood as MerchantMood | null) ?? null,
        message: r.message,
        vendor: { id: r.vendors.id, name: r.vendors.name, logoUrl: r.vendors.logo_url },
        staff: { name: r.staff_users.name, email: r.staff_users.email, role: r.staff_users.role },
      })),
      total,
      page,
      pageSize,
      moods: { love: count('love'), okay: count('okay'), unhappy: count('unhappy'), none: count(null) },
    };
  }

  private async write(userId: string, category: string, message: string): Promise<void> {
    if (!this.url || !this.secret) {
      throw new ServiceUnavailableException({
        code: 'feedback_not_configured',
        message:
          'FEEDBACK_SHEET_URL / FEEDBACK_SHEET_SECRET are not set on the server',
      });
    }

    let ok = false;
    let detail = '';
    try {
      // Apps Script answers a POST with a redirect to the result; fetch follows it.
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: this.secret,
          createdAt: new Date().toISOString(),
          userId,
          category,
          message,
        }),
        signal: AbortSignal.timeout(SHEET_TIMEOUT_MS),
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      ok = res.ok && body?.ok === true;
      detail = `${res.status} ${body?.error ?? ''}`;
    } catch (err) {
      detail = err instanceof Error ? err.message : String(err);
    }

    if (!ok) {
      this.logger.error(`Feedback sheet write failed: ${detail}`);
      throw new ServiceUnavailableException({
        code: 'feedback_unavailable',
        message: 'Could not send your feedback right now. Please try again.',
      });
    }
  }
}
