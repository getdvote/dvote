import { ConflictException, Injectable } from '@nestjs/common';
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
   *
   * One customer per email (wallet join, 2026-10-17): if someone already joined a merchant from
   * the web with this email (a customer row without a Supabase account), the sign-in is linked
   * to that row, so the app shows the same cards. Supabase only issues tokens for confirmed
   * emails (and Google/Facebook ones), so the email in the token can be trusted. An email that
   * already belongs to another login is not copied: that customer is created without one.
   */
  async findOrCreateFromAuth(claims: SupabaseClaims): Promise<users> {
    const bySub = () => this.prisma.users.findUnique({ where: { auth_user_id: claims.sub } });
    const existing = await bySub();
    if (existing) return existing;

    const meta = claims.user_metadata ?? {};
    const name = clip(meta.full_name ?? meta.name, 120);
    const avatar = clip(meta.avatar_url ?? meta.picture, 500);
    let email = clip(claims.email, 255);

    if (email) {
      const owner = await this.prisma.users.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
      if (owner && !owner.auth_user_id) {
        try {
          return await this.prisma.users.update({
            where: { id: owner.id },
            data: { auth_user_id: claims.sub, name: owner.name ?? name, avatar_url: owner.avatar_url ?? avatar },
          });
        } catch (err) {
          if (!isUniqueViolation(err)) throw err;
          const raced = await bySub(); // another first request linked it
          if (raced) return raced;
        }
      }
      if (owner) email = null; // the email belongs to another login: don't copy it
    }

    try {
      return await this.prisma.users.create({ data: { auth_user_id: claims.sub, name, email, avatar_url: avatar } });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Two first requests raced (the other one created the row), or the email was just taken.
      const raced = await bySub();
      if (raced) return raced;
      return this.prisma.users.create({ data: { auth_user_id: claims.sub, name, email: null, avatar_url: avatar } });
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
  /** Remember where the customer is now (6 decimals ≈ 10 cm), for "near you" shops. */
  async setLocation(userId: string, lat: number, lng: number): Promise<void> {
    await this.prisma.users.update({
      where: { id: userId },
      data: { last_lat: lat.toFixed(6), last_lng: lng.toFixed(6), last_location_at: new Date() },
    });
  }

  async removeAvatar(user: users): Promise<users> {
    if (user.avatar_path) {
      await this.storage.remove(BUCKETS.avatars, [user.avatar_path]);
    }
    return this.prisma.users.update({
      where: { id: user.id },
      data: { avatar_path: null, avatar_url: null },
    });
  }

  async updateProfile(id: string, dto: UpdateUserDto): Promise<users> {
    const { birthDate, ...rest } = dto;
    if (rest.email) {
      // one customer per email (unique, any case)
      const taken = await this.prisma.users.findFirst({
        where: { email: { equals: rest.email, mode: 'insensitive' }, id: { not: id } },
        select: { id: true },
      });
      if (taken) throw new ConflictException({ code: 'email_taken', message: 'This email is used by another customer.' });
    }
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

const isUniqueViolation = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

/** Provider data can exceed our column sizes; empty strings become NULL. */
function clip(value: string | undefined, max: number): string | null {
  const v = value?.trim();
  return v ? v.slice(0, max) : null;
}
