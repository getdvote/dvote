import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { Prisma, type users } from '../generated/prisma/client.js';
import { fromMinor, toMinor } from '../points/points';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleWalletService } from '../wallet/google-wallet.service';
import { egyptianMobile } from './egyptian-phone';
import type { JoinResultDto, JoinVendorDto, PublicCardDto, PublicVendorDto } from './dto/public-join.dto';

/** Letters and digits that can't be confused when read aloud or typed (no 0/O, 1/I/L). */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const shortCode = () => {
  const part = () => Array.from({ length: 3 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');
  return `${part()}-${part()}`;
};
const sameName = (n: string) => n.trim().replace(/\s+/g, ' ').toLowerCase();
const isUniqueViolation = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

const cardInclude = {
  users: { select: { name: true } },
  vendors: { select: { id: true, slug: true, name: true, logo_url: true, banner_url: true, card_design: true, currency: true, status: true } },
} satisfies Prisma.cardsInclude;
type CardRow = Prisma.cardsGetPayload<{ include: typeof cardInclude }>;

/**
 * The public side of joining a merchant (dvote.app/<slug>): the venue page data, joining
 * (creates the customer's card for that merchant, balance 0) and the card page.
 *
 * No sign-in (decided 2026-10-17): the customer is the email + mobile typed on the form.
 */
@Injectable()
export class PublicJoinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleWalletService,
  ) {}

  async walletStatus(publicId: string): Promise<{ google: boolean; apple: boolean }> {
    const card = await this.prisma.cards.findUnique({
      where: { public_id: publicId },
      select: { google_object_id: true, vendors: { select: { status: true } }, _count: { select: { wallet_registrations: true } } },
    });
    if (!card || card.vendors.status !== 'active') throw new NotFoundException({ code: 'card_not_found' });
    return { google: await this.google.isSaved(card.google_object_id), apple: card._count.wallet_registrations > 0 };
  }

  /** Venue page / join form data. Suspended or unknown merchants are not found. */
  async vendor(slug: string): Promise<PublicVendorDto> {
    const v = await this.prisma.vendors.findUnique({
      where: { slug },
      include: {
        point_rules: { where: { is_active: true }, take: 1 },
        rewards: { where: { status: 'active' }, orderBy: [{ sort_order: 'asc' }, { points_cost: 'asc' }] },
        branches: { where: { status: 'active' }, orderBy: { name: 'asc' }, select: { id: true, name: true } },
      },
    });
    if (!v || v.status !== 'active') throw new NotFoundException({ code: 'vendor_not_found' });
    const [rule] = v.point_rules;
    return {
      id: v.id,
      slug: v.slug,
      name: v.name,
      logoUrl: v.logo_url,
      bannerUrl: v.banner_url,
      category: v.category,
      cardDesign: v.card_design,
      currency: v.currency,
      rule: rule ? { spendAmount: fromMinor(toMinor(rule.spend_amount)), pointsPerSpend: rule.points_per_spend } : null,
      rewards: v.rewards.map((r) => ({ name: r.name, nameAr: r.name_ar, pointsCost: r.points_cost, imageUrl: r.image_url })),
      branches: v.branches,
    };
  }

  /**
   * Join a merchant from the form (no sign-in, decided 2026-10-17): name + Egyptian mobile. The
   * mobile is the customer key: a known mobile must come with the same name (any letter case or
   * spacing; otherwise anyone typing a number could see that card) and then joining again returns
   * the same card. A new mobile creates the customer.
   */
  async join(slug: string, dto: JoinVendorDto): Promise<JoinResultDto> {
    const vendor = await this.prisma.vendors.findUnique({ where: { slug }, select: { id: true, status: true } });
    if (!vendor || vendor.status !== 'active') throw new NotFoundException({ code: 'vendor_not_found' });

    const phone = egyptianMobile(dto.phone);
    if (!phone) throw new BadRequestException({ code: 'invalid_phone', message: 'Use an Egyptian mobile number (010, 011, 012 or 015).' });
    const name = dto.name.trim().replace(/\s+/g, ' ');
    if (name.length < 2) throw new BadRequestException({ code: 'name_required', message: 'Type your name.' });

    if (dto.branchId) {
      const branch = await this.prisma.branches.findFirst({
        where: { id: dto.branchId, vendor_id: vendor.id, status: 'active' },
        select: { id: true },
      });
      if (!branch) throw new BadRequestException({ code: 'invalid_branch' });
    }

    const user = await this.customer(name, phone, dto);

    const existing = await this.findCard(user.id, vendor.id);
    if (existing) return { created: false, card: this.present(await this.ensureShortCode(existing)) };

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const card = await this.prisma.cards.create({
          data: {
            user_id: user.id,
            vendor_id: vendor.id,
            short_code: shortCode(),
            joined_via: dto.source,
            joined_branch_id: dto.branchId ?? null,
            heard_from: dto.heardFrom ?? null,
          },
          include: cardInclude,
        });
        return { created: true, card: this.present(card) };
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        // the same customer joined twice at once, or the short code was taken: look, then retry
        const raced = await this.findCard(user.id, vendor.id);
        if (raced) return { created: false, card: this.present(await this.ensureShortCode(raced)) };
      }
    }
    throw new Error('could not pick a free short code');
  }

  /** The card page (dvote.app/c/<publicId>): anyone with the link can see it, like the pass. */
  async card(publicId: string): Promise<PublicCardDto> {
    const card = await this.prisma.cards.findUnique({ where: { public_id: publicId }, include: cardInclude });
    if (!card || card.vendors.status !== 'active') throw new NotFoundException({ code: 'card_not_found' });
    return this.present(await this.ensureShortCode(card));
  }

  /** The customer with this mobile, or a new one (the oldest row if the app made several). */
  private async customer(name: string, phone: string, dto: JoinVendorDto): Promise<users> {
    const known = await this.prisma.users.findFirst({ where: { phone }, orderBy: { created_at: 'asc' } });
    if (known) {
      if (known.name && sameName(known.name) !== sameName(name)) {
        // never say which part is wrong: the number alone must not reveal anything
        throw new ConflictException({ code: 'details_mismatch', message: 'This mobile number is already used with another name.' });
      }
      if (known.status === 'blocked') throw new ForbiddenException({ code: 'user_blocked' });
      if (known.name) return known;
      return this.prisma.users.update({ where: { id: known.id }, data: { name } });
    }
    const email = dto.email?.trim().toLowerCase();
    const emailFree = email ? !(await this.prisma.users.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } })) : false;
    return this.prisma.users.create({
      data: { name, phone, email: emailFree ? email : null, age_confirmed_at: dto.ageConfirmed ? new Date() : null },
    });
  }

  private findCard(userId: string, vendorId: string) {
    return this.prisma.cards.findUnique({ where: { user_id_vendor_id: { user_id: userId, vendor_id: vendorId } }, include: cardInclude });
  }

  /** Cards made by the app (first purchase) have no short code yet: give them one. */
  private async ensureShortCode(card: CardRow): Promise<CardRow> {
    for (let attempt = 0; !card.short_code && attempt < 5; attempt++) {
      try {
        card = await this.prisma.cards.update({ where: { id: card.id }, data: { short_code: shortCode() }, include: cardInclude });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
    }
    return card;
  }

  private present(c: CardRow): PublicCardDto {
    const v = c.vendors;
    return {
      publicId: c.public_id,
      shortCode: c.short_code ?? '',
      cardholder: c.users.name ?? '',
      balance: c.balance,
      vendor: { id: v.id, slug: v.slug, name: v.name, logoUrl: v.logo_url, bannerUrl: v.banner_url, cardDesign: v.card_design, currency: v.currency },
      createdAt: c.created_at.toISOString(),
    };
  }
}
