import { ParseUuidPipe } from '../common/uuid';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import {
  CreateStaffResponseDto,
  StaffResponseDto,
} from '../staff/dto/staff-response.dto';
import { StaffService } from '../staff/staff.service';
import { ApiImageUpload } from '../storage/api-image-upload.decorator';
import { CreateVendorAdminDto } from './dto/create-vendor-admin.dto';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { ListVendorsQueryDto } from './dto/list-vendors-query.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { VendorResponseDto } from './dto/vendor-response.dto';
import { VendorsService } from './vendors.service';

@ApiTags('admin: vendors')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'missing_token | invalid_token | token_expired',
})
@ApiForbiddenResponse({
  description: 'not_admin | admin_disabled | mfa_required',
})
@UseGuards(PlatformAdminGuard)
@Controller('admin/vendors')
export class AdminVendorsController {
  constructor(
    private readonly vendors: VendorsService,
    private readonly staff: StaffService,
  ) {}

  @Get()
  @ApiOkResponse({ type: [VendorResponseDto] })
  async list(
    @Query() query: ListVendorsQueryDto,
  ): Promise<VendorResponseDto[]> {
    return (await this.vendors.list(query)).map(VendorResponseDto.from);
  }

  @Get(':id')
  @ApiOkResponse({ type: VendorResponseDto })
  @ApiNotFoundResponse({ description: 'vendor_not_found' })
  async get(
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<VendorResponseDto> {
    return VendorResponseDto.from(await this.vendors.get(id));
  }

  /** Onboard a vendor. Then add its first vendor admin with POST /{id}/admins. */
  @Post()
  @ApiCreatedResponse({ type: VendorResponseDto })
  async create(@Body() dto: CreateVendorDto): Promise<VendorResponseDto> {
    return VendorResponseDto.from(await this.vendors.create(dto));
  }

  /** Edit details, or status=suspended (soft delete) / active again. */
  @Patch(':id')
  @ApiOkResponse({ type: VendorResponseDto })
  @ApiNotFoundResponse({ description: 'vendor_not_found' })
  @ApiConflictResponse({ description: 'currency_locked' })
  async update(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpdateVendorDto,
  ): Promise<VendorResponseDto> {
    return VendorResponseDto.from(await this.vendors.update(id, dto));
  }

  /** Upload or replace the vendor's logo (public; the previous uploaded logo is deleted). */
  @Put(':id/logo')
  @ApiImageUpload()
  @ApiOkResponse({ type: VendorResponseDto })
  @ApiNotFoundResponse({ description: 'vendor_not_found' })
  async setLogo(
    @Param('id', ParseUuidPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<VendorResponseDto> {
    return VendorResponseDto.from(await this.vendors.setLogo(id, file.buffer));
  }

  /** Remove the vendor's logo; an uploaded file is deleted from storage. */
  @Delete(':id/logo')
  @ApiOkResponse({ type: VendorResponseDto })
  @ApiNotFoundResponse({ description: 'vendor_not_found' })
  async removeLogo(
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<VendorResponseDto> {
    return VendorResponseDto.from(await this.vendors.removeLogo(id));
  }

  /** Invite a vendor_admin (e.g. the owner) by email; they then manage their own staff. */
  @Post(':id/admins')
  @ApiCreatedResponse({ type: CreateStaffResponseDto })
  @ApiNotFoundResponse({ description: 'vendor_not_found' })
  @ApiConflictResponse({ description: 'email_taken | account_already_staff' })
  @ApiServiceUnavailableResponse({
    description: 'auth_admin_not_configured | auth_provider_error',
  })
  async addAdmin(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: CreateVendorAdminDto,
  ): Promise<CreateStaffResponseDto> {
    const { staff, invited } = await this.staff.createVendorAdmin({
      vendorId: id,
      name: dto.name,
      email: dto.email,
    });
    return { ...StaffResponseDto.from(staff), invited };
  }
}
