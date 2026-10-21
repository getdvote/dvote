import { ExecutionContext, HttpException, HttpStatus, Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Throttle, ThrottlerGuard, ThrottlerModule, type ThrottlerLimitDetail } from '@nestjs/throttler';
import { decodeJwt } from 'jose';
import type { Env } from '../config/env.validation';

const MINUTE = 60_000;

/**
 * Who a request counts against for the per-user limit: the signed-in user (the token's `sub`),
 * or the IP address without a token. The token is only read here, not verified (the auth guards
 * do that after): a forged token just gets its own bucket, and the per-IP limit still applies.
 */
export function userTracker(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): string {
  const auth = req.headers?.authorization;
  const token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) {
    try {
      const sub = decodeJwt(token).sub;
      if (sub) return `user:${sub}`;
    } catch {
      // not a JWT: fall through to the IP
    }
  }
  return `ip:${req.ip ?? 'unknown'}`;
}

/** Stricter per-user limits for endpoints that are costly or worth abusing (per minute). */
export const LIMITS = {
  /** Making QR codes: a customer needs a handful per visit. */
  qrCreate: 20,
  /** Staff scans (preview + collect + redeem): a busy counter, but not a script. */
  scans: 60,
  /** Image uploads (re-encoded with sharp: heavy on CPU and memory). */
  uploads: 10,
  /** Joining a merchant from the public site, per IP (no sign-in): a busy café's Wi-Fi is one IP. */
  join: 30,
  /** Merchant sign-up from the public page, per IP (each one sends an email). */
  signup: 5,
} as const;

/** A stricter per-user limit on one endpoint (the per-IP limit still applies too). */
export const UserLimit = (perMinute: number) => Throttle({ user: { limit: perMinute, ttl: MINUTE } });

/** Same as ThrottlerGuard, but the 429 carries our stable error code. */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected throwThrottlingException(context: ExecutionContext, detail: ThrottlerLimitDetail): Promise<void> {
    // The library names it Retry-After-<throttler>; clients and proxies know the plain header.
    const seconds = Math.max(1, Math.ceil(detail.timeToBlockExpire));
    context.switchToHttp().getResponse<{ header(name: string, value: string): void }>().header('Retry-After', String(seconds));
    throw new HttpException(
      { statusCode: 429, code: 'rate_limited', message: 'Too many requests. Please wait a moment and try again.', retryAfterSeconds: seconds },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/**
 * Flood protection for every API route (in memory: right for one API container; several would
 * need a shared store such as Redis). Two limits, both per minute:
 * - `ip`: every request from one IP address (signed in or not), RATE_LIMIT_IP_PER_MIN;
 * - `user`: every request from one signed-in user, RATE_LIMIT_USER_PER_MIN, stricter on some
 *   endpoints (`LIMITS`).
 * Behind Cloudflare / a load balancer set TRUST_PROXY so the real client IP is used.
 * Answers 429 `rate_limited` with a Retry-After header.
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: [
          { name: 'ip', ttl: MINUTE, limit: config.get('RATE_LIMIT_IP_PER_MIN', { infer: true }) },
          { name: 'user', ttl: MINUTE, limit: config.get('RATE_LIMIT_USER_PER_MIN', { infer: true }), getTracker: userTracker },
        ],
        skipIf: () => !config.get('RATE_LIMIT_ENABLED', { infer: true }),
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: RateLimitGuard }],
})
export class RateLimitModule {}
