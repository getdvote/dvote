import { Query } from '@nestjs/common';
import { StorefrontUsernameDto } from './dto/storefront-username.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Put,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
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
import { ApiImageUpload } from '../storage/api-image-upload.decorator';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto';
import { VendorResponseDto } from './dto/vendor-response.dto';
import { VendorsService } from './vendors.service';
import { EntitlementsService } from '../plans/entitlements.service';

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
  constructor(
    private readonly vendors: VendorsService,
    private readonly plans: EntitlementsService,
  ) {}

  @Get('username')
  @StaffRoles('vendor_admin')
  usernameAvailability(@CurrentStaff() ctx: StaffContext, @Query() query: StorefrontUsernameDto) {
    return this.vendors.usernameAvailability(ctx.vendorId, query.username);
  }

  @Put('username')
  @StaffRoles('vendor_admin')
  async reserveUsername(@CurrentStaff() ctx: StaffContext, @Body() dto: StorefrontUsernameDto) {
    return VendorResponseDto.from(await this.vendors.reserveUsername(ctx.vendorId, dto.username));
  }

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
    // page style, brand colours and font are a plan feature (Regular keeps the dvote template)
    if (dto.pageStyle !== undefined || dto.brandPrimary !== undefined || dto.brandSecondary !== undefined || dto.brandFont !== undefined) {
      await this.plans.require(ctx, 'brand_style');
    }
    return VendorResponseDto.from(await this.vendors.update(ctx.vendorId, dto));
  }

  /** vendor_admin only: upload or replace the logo (public; the previous uploaded logo is deleted). */
  @Put('logo')
  @StaffRoles('vendor_admin')
  @ApiImageUpload()
  @ApiOkResponse({ type: VendorResponseDto })
  async setLogo(
    @CurrentStaff() ctx: StaffContext,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<VendorResponseDto> {
    return VendorResponseDto.from(await this.vendors.setLogo(ctx.vendorId, file.buffer));
  }

  /** vendor_admin only: remove the logo; an uploaded file is deleted from storage. */
  @Delete('logo')
  @StaffRoles('vendor_admin')
  @ApiOkResponse({ type: VendorResponseDto })
  async removeLogo(@CurrentStaff() ctx: StaffContext): Promise<VendorResponseDto> {
    return VendorResponseDto.from(await this.vendors.removeLogo(ctx.vendorId));
  }

  /** vendor_admin only: upload or replace the shop-page banner (previous file deleted). */
  @Put('banner')
  @StaffRoles('vendor_admin')
  @ApiImageUpload()
  @ApiOkResponse({ type: VendorResponseDto })
  async setBanner(
    @CurrentStaff() ctx: StaffContext,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<VendorResponseDto> {
    return VendorResponseDto.from(await this.vendors.setBanner(ctx.vendorId, file.buffer));
  }

  /** vendor_admin only: remove the banner; the file is deleted from storage. */
  @Delete('banner')
  @StaffRoles('vendor_admin')
  @ApiOkResponse({ type: VendorResponseDto })
  async removeBanner(@CurrentStaff() ctx: StaffContext): Promise<VendorResponseDto> {
    return VendorResponseDto.from(await this.vendors.removeBanner(ctx.vendorId));
  }
}
