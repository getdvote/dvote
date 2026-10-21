import { ForbiddenException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';

/** Cloudflare Turnstile (the captcha on the merchant sign-up page), checked on the server. */
@Injectable()
export class TurnstileService {
  private readonly log = new Logger(TurnstileService.name);
  constructor(private readonly config: ConfigService<Env, true>) {}

  async verify(token: string | undefined, ip?: string): Promise<void> {
    const secret = this.config.get('TURNSTILE_SECRET_KEY', { infer: true });
    if (!secret) {
      if (this.config.get('NODE_ENV', { infer: true }) === 'production') {
        throw new ServiceUnavailableException({ code: 'captcha_not_configured', message: 'Sign-up is not available right now.' });
      }
      return; // development: no captcha configured
    }
    if (!token) throw new ForbiddenException({ code: 'captcha_failed', message: 'Please complete the check.' });
    try {
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
        signal: AbortSignal.timeout(8000),
      });
      const json = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
      if (json.success) return;
      this.log.warn(`captcha rejected: ${(json['error-codes'] ?? []).join(', ')}`);
    } catch (err) {
      this.log.warn(`captcha check failed: ${String(err)}`);
    }
    throw new ForbiddenException({ code: 'captcha_failed', message: 'Please complete the check again.' });
  }
}
