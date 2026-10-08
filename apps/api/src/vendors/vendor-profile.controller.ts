import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentStaff } from '../auth/current-staff.decorator';
import {
  StaffAuthGuard,
  StaffRoles,
  type StaffContext,
} from '../auth/staff-auth.guard';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto';
import { VendorResponseDto } from './dto/vendor-response.dto';
import { VendorsService } from './vendors.service';

/**
 * A vendor's own profile, for its staff. No id in the URL: the vendor always comes
 * from the signed-in staff member, so nobody can read or edit another vendor here.
 */
@ApiTags('vendor: profile')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'missing_token | invalid_token | token_expired',
})
@ApiForbiddenResponse({
  description:
    'not_staff | staff_disabled | vendor_suspended | branch_closed | forbidden_role',
})
@UseGuards(StaffAuthGuard)
@Controller('vendor/profile')
export class VendorProfileController {
  constructor(private readonly vendors: VendorsService) {}

  /** Any staff role: the vendor they work for. */
  @Get()
  @ApiOkResponse({ type: VendorResponseDto })
  async get(@CurrentStaff() ctx: StaffContext): Promise<VendorResponseDto> {
    return VendorResponseDto.from(await this.vendors.get(ctx.vendorId));
  }

  /** vendor_admin only: name, logo, contact email. */
  @Patch()
  @StaffRoles('vendor_admin')
  @ApiOkResponse({ type: VendorResponseDto })
  async update(
    @CurrentStaff() ctx: StaffContext,
    @Body() dto: UpdateVendorProfileDto,
  ): Promise<VendorResponseDto> {
    return VendorResponseDto.from(await this.vendors.update(ctx.vendorId, dto));
  }
}
