import { PickType } from '@nestjs/swagger';
import { UpdateVendorDto } from './update-vendor.dto';

/**
 * What a vendor admin may change on their own vendor. status (suspend) and
 * currency stay with platform admins.
 */
export class UpdateVendorProfileDto extends PickType(UpdateVendorDto, [
  'name',
  'logoUrl',
  'contactEmail',
] as const) {}
