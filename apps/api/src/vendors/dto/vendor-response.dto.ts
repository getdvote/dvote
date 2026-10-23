import { ApiProperty } from '@nestjs/swagger';
import type { vendors } from '../../generated/prisma/client.js';
import { vendor_status } from '../../generated/prisma/enums.js';
import { VENDOR_CATEGORIES, type VendorCategory } from '../vendor-branding';

export class VendorResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Ecuador Coffee' })
  name: string;

  @ApiProperty({ type: String, nullable: true })
  logoUrl: string | null;

  @ApiProperty({ example: 'joy-corner', description: 'Public page address: m.dvote.co/<slug> (empty = none yet)' })
  slug: string;

  @ApiProperty({ type: String, nullable: true, description: 'Shop-page banner' })
  bannerUrl: string | null;

  @ApiProperty({ enum: VENDOR_CATEGORIES, nullable: true })
  category: VendorCategory | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Loyalty-card design 1-10; null = automatic' })
  cardDesign: number | null;

  @ApiProperty({ type: String, nullable: true })
  contactEmail: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Public page layout: spotlight | compact | branded | playful | split; null = spotlight' })
  pageStyle: string | null;

  @ApiProperty({ type: String, nullable: true }) brandPrimary: string | null;
  @ApiProperty({ type: String, nullable: true }) brandSecondary: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Font key, see storefront.ts BRAND_FONTS' }) brandFont: string | null;

  @ApiProperty({ type: String, nullable: true, example: '+201001234567' })
  contactPhone: string | null;

  @ApiProperty({ example: 'EGP' })
  currency: string;

  @ApiProperty({ enum: vendor_status, enumName: 'VendorStatus' })
  status: vendor_status;

  @ApiProperty({ enum: ['trial', 'active'], description: 'trial = self sign-up not paid yet (migration 31)' })
  planStatus: 'trial' | 'active';

  @ApiProperty({ type: String, nullable: true, enum: ['regular', 'loyal', 'chain'] })
  plan: string | null;

  @ApiProperty({ type: String, nullable: true, enum: ['monthly', 'annual'] })
  billingCycle: string | null;

  @ApiProperty({ description: 'Holds a Founding Merchant spot (migration 32)' }) founding: boolean;

  @ApiProperty({ type: String, nullable: true }) trialEndsAt: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Unpaid trial shops are deleted for good then' }) deleteAt: string | null;
  @ApiProperty({ description: 'Signed up by itself (merchant.dvote.co/signup)' }) selfSignup: boolean;

  @ApiProperty({ description: 'Branches (any status)' })
  branchCount: number;

  @ApiProperty({ description: 'Staff accounts (any status)' })
  staffCount: number;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  static from(
    v: vendors & { _count: { branches: number; staff_users: number } },
  ): VendorResponseDto {
    return {
      id: v.id,
      name: v.name,
      logoUrl: v.logo_url,
      slug: v.slug,
      bannerUrl: v.banner_url,
      category: v.category as VendorCategory | null,
      cardDesign: v.card_design,
      contactEmail: v.contact_email,
      pageStyle: v.page_style,
      brandPrimary: v.brand_primary,
      brandSecondary: v.brand_secondary,
      brandFont: v.brand_font,
      contactPhone: v.contact_phone,
      currency: v.currency,
      status: v.status,
      planStatus: v.plan_status === 'trial' ? 'trial' : 'active',
      plan: v.plan,
      billingCycle: v.billing_cycle,
      founding: v.founding,
      trialEndsAt: v.trial_ends_at?.toISOString() ?? null,
      deleteAt: v.delete_at?.toISOString() ?? null,
      selfSignup: v.self_signup,
      branchCount: v._count.branches,
      staffCount: v._count.staff_users,
      createdAt: v.created_at.toISOString(),
      updatedAt: v.updated_at.toISOString(),
    };
  }
}
