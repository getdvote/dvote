import { ApiProperty } from '@nestjs/swagger';
import type { vendor_images } from '../../generated/prisma/client.js';
import { vendor_image_kind } from '../../generated/prisma/enums.js';

export class VendorImageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: vendor_image_kind, enumName: 'VendorImageKind' })
  kind: vendor_image_kind;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Set for branch photos' })
  branchId: string | null;

  @ApiProperty({ description: 'Public, permanent link to the WebP image' })
  url: string;

  @ApiProperty({ example: 0, description: 'Display order (oldest first)' })
  sortOrder: number;

  @ApiProperty()
  createdAt: string;

  static from(image: vendor_images, url: string): VendorImageResponseDto {
    return {
      id: image.id,
      kind: image.kind,
      branchId: image.branch_id,
      url,
      sortOrder: image.sort_order,
      createdAt: image.created_at.toISOString(),
    };
  }
}
