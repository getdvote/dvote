import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { users } from '../generated/prisma/client.js';
import { UsersService } from '../users/users.service';
import { SupabaseJwtVerifier } from './supabase-jwt.verifier';

/**
 * Customers may only sign in with these providers (no email/password, no anonymous).
 * Apple is postponed (needs the paid Apple Developer Program); add 'apple' here when enabled.
 */
const CUSTOMER_PROVIDERS = new Set(['google', 'facebook']);

export interface CustomerRequest extends Request {
  user: users;
}

/**
 * Guards /api/app routes: verifies the Supabase token, then loads (or creates on
 * first visit) the matching `users` row and attaches it to the request.
 */
@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(
    private readonly verifier: SupabaseJwtVerifier,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<CustomerRequest>();
    const token = bearerToken(req);
    if (!token) throw new UnauthorizedException({ code: 'missing_token' });

    const claims = await this.verifier.verify(token);

    const providers = claims.app_metadata?.providers ?? [
      claims.app_metadata?.provider,
    ];
    if (
      claims.is_anonymous ||
      !providers.some((p) => p !== undefined && CUSTOMER_PROVIDERS.has(p))
    ) {
      throw new ForbiddenException({ code: 'provider_not_allowed' });
    }

    const user = await this.users.findOrCreateFromAuth(claims);
    if (user.status === 'blocked') {
      throw new ForbiddenException({ code: 'user_blocked' });
    }

    req.user = user;
    return true;
  }
}

function bearerToken(req: Request): string | undefined {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}
