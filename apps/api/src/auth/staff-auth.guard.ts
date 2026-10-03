import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { staff_role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { bearerToken } from './bearer-token';
import { SupabaseJwtVerifier } from './supabase-jwt.verifier';

/**
 * Who is calling a /api/vendor route. Built once by StaffAuthGuard; services scope
 * every query with it (vendorId always, branchId for branch roles).
 */
export interface StaffContext {
  staffId: string;
  vendorId: string;
  /** null for vendor_admin (vendor-wide). */
  branchId: string | null;
  role: staff_role;
}

export interface StaffRequest extends Request {
  staff: StaffContext;
}

const STAFF_ROLES_KEY = 'staffRoles';

/** Restricts a controller or route to these staff roles (default: any active staff). */
export const StaffRoles = (...roles: staff_role[]) =>
  SetMetadata(STAFF_ROLES_KEY, roles);

/**
 * Guards /api/vendor routes: verifies the Supabase token, then requires an active
 * staff_users row linked to it, in an active vendor (and active branch for branch roles).
 * Any sign-in method is fine (password, or Google if the email matches); the row decides access.
 */
@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(
    private readonly verifier: SupabaseJwtVerifier,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffRequest>();
    const token = bearerToken(req);
    if (!token) throw new UnauthorizedException({ code: 'missing_token' });

    const claims = await this.verifier.verify(token);
    if (claims.is_anonymous) {
      throw new ForbiddenException({ code: 'not_staff' });
    }

    const staff = await this.prisma.staff_users.findUnique({
      where: { auth_user_id: claims.sub },
      include: {
        vendors: { select: { status: true } },
        branches: { select: { status: true } },
      },
    });
    if (!staff) throw new ForbiddenException({ code: 'not_staff' });
    if (staff.status !== 'active') {
      throw new ForbiddenException({ code: 'staff_disabled' });
    }
    if (staff.vendors.status !== 'active') {
      throw new ForbiddenException({ code: 'vendor_suspended' });
    }
    if (staff.branches && staff.branches.status !== 'active') {
      throw new ForbiddenException({ code: 'branch_closed' });
    }

    const allowed = this.reflector.getAllAndOverride<staff_role[] | undefined>(
      STAFF_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed && !allowed.includes(staff.role)) {
      throw new ForbiddenException({ code: 'forbidden_role' });
    }

    req.staff = {
      staffId: staff.id,
      vendorId: staff.vendor_id,
      branchId: staff.branch_id,
      role: staff.role,
    };
    return true;
  }
}
