import { Injectable } from '@nestjs/common';
import { Prisma, type users } from '../generated/prisma/client.js';
import type { SupabaseClaims } from '../auth/supabase-jwt.verifier';
import { PrismaService } from '../prisma/prisma.service';
import { IMAGE_CONTENT_TYPE, newImageName, toWebp } from '../storage/images';
import { BUCKETS, StorageService } from '../storage/storage.service';
import type { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

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

  /** The profile as the app sees it: an uploaded photo becomes a short-lived signed link. */
  async present(user: users): Promise<UserResponseDto> {
    if (!user.avatar_path) return UserResponseDto.from(user);
    try {
      return UserResponseDto.from(
        user,
        await this.storage.signedUrl(BUCKETS.avatars, user.avatar_path),
      );
    } catch {
      // Storage hiccup: the profile still loads, just without the photo this time.
      return UserResponseDto.from(user, user.avatar_url);
    }
  }

  /**
   * Uploads (or replaces) the customer's photo: new file first, then the row, then the old
   * file is deleted. A failure in between never leaves the profile pointing at a missing file.
   */
  async setAvatar(user: users, file: Buffer): Promise<users> {
    const webp = await toWebp(file, 'avatar');
    const path = `${user.id}/${newImageName()}`;
    await this.storage.upload(BUCKETS.avatars, path, webp, IMAGE_CONTENT_TYPE);
    let updated: users;
    try {
      updated = await this.prisma.users.update({
        where: { id: user.id },
        data: { avatar_path: path },
      });
    } catch (err) {
      await this.storage.removeQuietly(BUCKETS.avatars, [path]);
      throw err;
    }
    if (user.avatar_path) {
      await this.storage.removeQuietly(BUCKETS.avatars, [user.avatar_path]);
    }
    return updated;
  }

  /** Removes the photo: the uploaded file is deleted from Storage and the provider photo is cleared too. */
  async removeAvatar(user: users): Promise<users> {
    if (user.avatar_path) {
      await this.storage.remove(BUCKETS.avatars, [user.avatar_path]);
    }
    return this.prisma.users.update({
      where: { id: user.id },
      data: { avatar_path: null, avatar_url: null },
    });
  }

  updateProfile(id: string, dto: UpdateUserDto): Promise<users> {
    const { birthDate, ...rest } = dto;
    return this.prisma.users.update({
      where: { id },
      data: {
        ...rest,
        // a plain date: midnight UTC is stored as that same calendar day
        ...(birthDate !== undefined
          ? { birth_date: birthDate ? new Date(`${birthDate}T00:00:00Z`) : null }
          : {}),
      },
    });
  }
}

/** Provider data can exceed our column sizes; empty strings become NULL. */
function clip(value: string | undefined, max: number): string | null {
  const v = value?.trim();
  return v ? v.slice(0, max) : null;
}
