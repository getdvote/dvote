import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** The API's own emails, sent through Resend. Without RESEND_API_KEY nothing is sent. */
@Injectable()
export class EmailService {
  private readonly log = new Logger(EmailService.name);
  constructor(private readonly config: ConfigService<Env, true>) {}

  get enabled(): boolean {
    return !!this.config.get('RESEND_API_KEY', { infer: true });
  }

  /** Throws when Resend refuses or can't be reached, so the caller can try again later. */
  async send(email: Email): Promise<void> {
    const key = this.config.get('RESEND_API_KEY', { infer: true });
    if (!key) throw new Error('email not configured');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: this.config.get('EMAIL_FROM', { infer: true }) || 'dvote <no-reply@dvote.co>',
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.log.warn(`Resend refused an email (${res.status}): ${body.slice(0, 200)}`);
      throw new Error(`resend_${res.status}`);
    }
  }
}
