import { Injectable } from '@nestjs/common';
import { Prisma, type users } from '../generated/prisma/client.js';
import type { SupabaseClaims } from '../auth/supabase-jwt.verifier';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the customer linked to this Supabase account, creating it on the first visit.
   * Supabase already links Google/Facebook logins with the same verified email
   * into one auth user, so one `sub` = one customer here.
   */
  async findOrCreateFromAuth(claims: SupabaseClaims): Promise<users> {
    const existing = await this.prisma.users.findUnique({
      where: { auth_user_id: claims.sub },
    });
    if (existing) return existing;

    const meta = claims.user_metadata ?? {};
    try {
      return await this.prisma.users.create({
        data: {
          auth_user_id: claims.sub,
          name: clip(meta.full_name ?? meta.name, 120),
          email: clip(claims.email, 255),
          avatar_url: clip(meta.avatar_url ?? meta.picture, 500),
        },
      });
    } catch (err) {
      // Two first requests raced: the other one created the row.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return this.prisma.users.findUniqueOrThrow({
          where: { auth_user_id: claims.sub },
        });
      }
      throw err;
    }
  }

  updateProfile(
    id: string,
    data: { name?: string; email?: string; phone?: string },
  ): Promise<users> {
    return this.prisma.users.update({ where: { id }, data });
  }
}

/** Provider data can exceed our column sizes; empty strings become NULL. */
function clip(value: string | undefined, max: number): string | null {
  const v = value?.trim();
  return v ? v.slice(0, max) : null;
}
