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
} from './dto/create-feedback.dto';

const SHEET_TIMEOUT_MS = 10_000;

/**
 * Sends customer and merchant feedback to the feedback Google Sheet through its Apps Script web app
 * (google-apps-script/feedback.gs). Feedback is not stored in our database.
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

  /** Quick feedback from the merchant dashboard: same sheet, the sender is the shop and staff member. */
  async sendMerchant(ctx: StaffContext, dto: MerchantFeedbackDto): Promise<void> {
    const staff = await this.prisma.staff_users.findUniqueOrThrow({
      where: { id: ctx.staffId },
      select: { name: true, email: true, vendors: { select: { name: true } } },
    });
    await this.write(
      `merchant · ${staff.vendors.name} · ${staff.name} <${staff.email}> (${ctx.role})`,
      `Merchant feedback${dto.mood ? ` · ${MERCHANT_MOODS[dto.mood]}` : ''}`,
      dto.message,
    );
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
