import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { Prisma, type users } from '../generated/prisma/client.js';
import { fromMinor, toMinor } from '../points/points';
import { PrismaService } from '../prisma/prisma.service';
import { BUCKETS, StorageService } from '../storage/storage.service';
import { GoogleWalletService } from '../wallet/google-wallet.service';
import { egyptianMobile } from './egyptian-phone';
import { BRAND_FONTS, readStorefront, type BrandFont, type PageStyle } from '../storefront/storefront';
import { readDesign } from '../loyalty-cards/card-design';
import type { PublicCardLookDto } from './dto/public-join.dto';
import type { JoinResultDto, JoinVendorDto, PublicCardDto, PublicVendorDto } from './dto/public-join.dto';

/** Letters and digits that can't be confused when read aloud or typed (no 0/O, 1/I/L). */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const shortCode = () => {
  const part = () => Array.from({ length: 3 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');
  return `${part()}-${part()}`;
};
const isUniqueViolation = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

const lookSelect = { name: true, status: true, live_version: { select: { design: true } } } satisfies Prisma.loyalty_cardsSelect;
type LookRow = Prisma.loyalty_cardsGetPayload<{ select: typeof lookSelect }>;

/** What the web pages draw of the merchant's card (null = no card yet: the old design). */
function look(card: LookRow | null): PublicCardLookDto | null {
  if (!card) return null;
  const d = readDesign(card.live_version?.design, card.name);
  return {
    status: card.status as PublicCardLookDto['status'],
    title: d.front.title,
    pointsLabel: d.front.pointsLabel,
    colors: { background: d.colors.background, text: d.colors.text, label: d.colors.label },
    background: { style: d.background.style, imageUrl: d.background.imageUrl },
  };
}

const cardInclude = {
  users: { select: { name: true } },
  vendors: {
    select: {
      id: true, slug: true, name: true, logo_url: true, banner_url: true, card_design: true, currency: true, status: true,
      loyalty_cards: { select: lookSelect },
    },
  },
} satisfies Prisma.cardsInclude;
type CardRow = Prisma.cardsGetPayload<{ include: typeof cardInclude }>;

/**
 * The public side of joining a merchant (m.dvote.co/<slug>): the venue page data, joining
 * (creates the customer's card for that merchant, balance 0) and the card page.
 *
 * No sign-in (decided 2026-10-17): the customer is identified by the normalized mobile number.
 */
@Injectable()
export class PublicJoinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleWalletService,
    private readonly storage: StorageService,
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
  async vendor(slug: string, branchId?: string): Promise<PublicVendorDto> {
    const v = await this.prisma.vendors.findUnique({
      where: { slug },
      include: {
        point_rules: { where: { is_active: true }, take: 1 },
        rewards: { where: { status: 'active' }, orderBy: [{ sort_order: 'asc' }, { points_cost: 'asc' }] },
        branches: {
          where: { status: 'active' },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, address: true, lat: true, lng: true, storefront: true },
        },
        vendor_images: { where: { kind: 'menu' }, orderBy: { sort_order: 'asc' }, select: { storage_path: true } },
        loyalty_cards: { select: lookSelect },
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
      card: look(v.loyalty_cards),
      currency: v.currency,
      rule: rule ? { spendAmount: fromMinor(toMinor(rule.spend_amount)), pointsPerSpend: rule.points_per_spend } : null,
      rewards: v.rewards.map((r) => ({ name: r.name, nameAr: r.name_ar, pointsCost: r.points_cost, imageUrl: r.image_url })),
      branches: v.branches.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        mapsUrl: b.lat !== null && b.lng !== null ? `https://www.google.com/maps/dir/?api=1&destination=${String(b.lat)},${String(b.lng)}` : null,
      })),
      style: {
        pageStyle: (v.page_style as PageStyle | null) ?? 'spotlight',
        primary: v.brand_primary,
        secondary: v.brand_secondary,
        font: v.brand_font ? (BRAND_FONTS[v.brand_font as BrandFont] ?? null) : null,
      },
      // a branch's own storefront when the page is opened for it (?b=), else the shop's
      sections: readStorefront(v.branches.find((b) => b.id === branchId)?.storefront ?? v.storefront).sections,
      menu: v.vendor_images.map((i) => this.storage.publicUrl(BUCKETS.vendors, i.storage_path)),
    };
  }

  /**
   * Join a merchant from the form (no sign-in, decided 2026-10-17): name + Egyptian mobile. The
   * mobile is the customer key: an existing mobile returns the same customer regardless of
   * the entered name. A new mobile creates the customer; an existing name is never overwritten.
   */
  async join(slug: string, dto: JoinVendorDto): Promise<JoinResultDto> {
    const vendor = await this.prisma.vendors.findUnique({
      where: { slug },
      select: { id: true, status: true, loyalty_cards: { select: { status: true } } },
    });
    if (!vendor || vendor.status !== 'active') throw new NotFoundException({ code: 'vendor_not_found' });
    // a cancelled card takes nothing at all ("get it back" too)
    const cardStatus = vendor.loyalty_cards?.status;
    if (cardStatus === 'cancelled') throw new ConflictException({ code: 'card_cancelled' });

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

    // a paused card takes no new members; existing ones still get their card back
    if (cardStatus === 'paused') {
      const known = await this.prisma.users.findFirst({ where: { phone }, orderBy: { created_at: 'asc' }, select: { id: true } });
      if (!known || !(await this.findCard(known.id, vendor.id))) throw new ConflictException({ code: 'card_paused' });
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

  /** The card page (m.dvote.co/c/<publicId>): anyone with the link can see it, like the pass. */
  async card(publicId: string): Promise<PublicCardDto> {
    const card = await this.prisma.cards.findUnique({ where: { public_id: publicId }, include: cardInclude });
    if (!card || card.vendors.status !== 'active') throw new NotFoundException({ code: 'card_not_found' });
    return this.present(await this.ensureShortCode(card));
  }

  /** The customer with this mobile, or a new one (the oldest row if the app made several). */
  private async customer(name: string, phone: string, dto: JoinVendorDto): Promise<users> {
    const known = await this.prisma.users.findFirst({ where: { phone }, orderBy: { created_at: 'asc' } });
    if (known) {
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
      vendor: { id: v.id, slug: v.slug, name: v.name, logoUrl: v.logo_url, bannerUrl: v.banner_url, cardDesign: v.card_design, card: look(v.loyalty_cards), currency: v.currency },
      createdAt: c.created_at.toISOString(),
    };
  }
}
