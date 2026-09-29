import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { Env } from '../config/env.validation';

/** DI token for the key set used to check Supabase signatures (overridden in tests). */
export const SUPABASE_JWKS = Symbol('SUPABASE_JWKS');

/** The Supabase access-token claims this API relies on. */
export interface SupabaseClaims {
  /** Supabase Auth user id (auth.users.id). Stable across linked providers. */
  sub: string;
  email?: string;
  role: string;
  is_anonymous?: boolean;
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
  user_metadata?: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    picture?: string;
  };
}

/**
 * Verifies Supabase access tokens locally (no call to Supabase per request).
 * Uses the project's asymmetric signing keys published at /auth/v1/.well-known/jwks.json;
 * jose caches the key set and refetches it when Supabase rotates keys.
 */
@Injectable()
export class SupabaseJwtVerifier {
  private readonly issuer: string;

  constructor(
    @Inject(SUPABASE_JWKS) private readonly jwks: JWTVerifyGetKey,
    config: ConfigService<Env, true>,
  ) {
    const url = config.get('SUPABASE_URL', { infer: true }).replace(/\/+$/, '');
    this.issuer = `${url}/auth/v1`;
  }

  async verify(token: string): Promise<SupabaseClaims> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: 'authenticated',
        algorithms: ['ES256', 'RS256'],
      });
      if (typeof payload.sub !== 'string' || payload.role !== 'authenticated') {
        throw new UnauthorizedException({ code: 'invalid_token' });
      }
      return payload as unknown as SupabaseClaims;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      const code =
        err instanceof errors.JWTExpired ? 'token_expired' : 'invalid_token';
      throw new UnauthorizedException({ code });
    }
  }
}
