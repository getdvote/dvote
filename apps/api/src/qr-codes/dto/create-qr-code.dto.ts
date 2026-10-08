import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/**
 * A collect QR names no shop: the vendor and branch always come from the staff member who
 * scans it, so the customer can't pick the wrong one. (Sending vendorId is rejected: 400.)
 */
export class CreateQrCodeDto {
  @ApiProperty({
    enum: ['collect'],
    description:
      'collect = earn points on a purchase at whichever shop scans it (redeem comes with the redeem flow)',
  })
  @IsIn(['collect'])
  purpose: 'collect';
}
