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

  @ApiProperty({ type: String, nullable: true, description: 'Shop-page banner' })
  bannerUrl: string | null;

  @ApiProperty({ enum: VENDOR_CATEGORIES, nullable: true })
  category: VendorCategory | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Loyalty-card design 1-10; null = automatic' })
  cardDesign: number | null;

  @ApiProperty({ type: String, nullable: true })
  contactEmail: string | null;

  @ApiProperty({ example: 'EGP' })
  currency: string;

  @ApiProperty({ enum: vendor_status, enumName: 'VendorStatus' })
  status: vendor_status;

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
      bannerUrl: v.banner_url,
      category: v.category as VendorCategory | null,
      cardDesign: v.card_design,
      contactEmail: v.contact_email,
      currency: v.currency,
      status: v.status,
      branchCount: v._count.branches,
      staffCount: v._count.staff_users,
      createdAt: v.created_at.toISOString(),
      updatedAt: v.updated_at.toISOString(),
    };
  }
}
