import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.validation';
import {
  FEEDBACK_CATEGORIES,
  type CreateFeedbackDto,
} from './dto/create-feedback.dto';

const SHEET_TIMEOUT_MS = 10_000;

/**
 * Sends customer feedback to the feedback Google Sheet through its Apps Script web app
 * (google-apps-script/feedback.gs). Feedback is not stored in our database.
 */
@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);
  private readonly url: string | undefined;
  private readonly secret: string | undefined;

  constructor(config: ConfigService<Env, true>) {
    this.url = config.get('FEEDBACK_SHEET_URL', { infer: true });
    this.secret = config.get('FEEDBACK_SHEET_SECRET', { infer: true })?.trim();
  }

  async send(userId: string, dto: CreateFeedbackDto): Promise<void> {
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
          category: FEEDBACK_CATEGORIES[dto.category],
          message: dto.message,
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
