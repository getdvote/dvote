import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { Env } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { bearerToken } from './bearer-token';
import { SupabaseJwtVerifier } from './supabase-jwt.verifier';

/** Who is calling an /api/admin route. */
export interface AdminContext {
  adminId: string;
}

export interface AdminRequest extends Request {
  admin: AdminContext;
}

/**
 * Guards /api/admin routes: verifies the Supabase token, requires two-factor login
 * (token aal2) unless ADMIN_MFA_REQUIRED=false, and an active platform_admins row
 * linked to the account.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  private readonly mfaRequired: boolean;

  constructor(
    private readonly verifier: SupabaseJwtVerifier,
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.mfaRequired = config.get('ADMIN_MFA_REQUIRED', { infer: true });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const token = bearerToken(req);
    if (!token) throw new UnauthorizedException({ code: 'missing_token' });

    const claims = await this.verifier.verify(token);
    if (claims.is_anonymous)
      throw new ForbiddenException({ code: 'not_admin' });

    const admin = await this.prisma.platform_admins.findUnique({
      where: { auth_user_id: claims.sub },
    });
    if (!admin) throw new ForbiddenException({ code: 'not_admin' });
    if (admin.status !== 'active') {
      throw new ForbiddenException({ code: 'admin_disabled' });
    }
    // Checked after the admin lookup so non-admins never learn MFA is involved.
    if (this.mfaRequired && claims.aal !== 'aal2') {
      throw new ForbiddenException({ code: 'mfa_required' });
    }

    req.admin = { adminId: admin.id };
    return true;
  }
}
