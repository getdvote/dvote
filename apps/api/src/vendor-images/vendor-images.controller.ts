import { ParseUuidPipe } from '../common/uuid';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
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
import { CreateVendorImageDto } from './dto/create-vendor-image.dto';
import { ListVendorImagesQueryDto } from './dto/list-vendor-images-query.dto';
import { VendorImageResponseDto } from './dto/vendor-image-response.dto';
import { VendorImagesService } from './vendor-images.service';

@ApiTags('vendor: images')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'missing_token | invalid_token | token_expired',
})
@ApiForbiddenResponse({
  description:
    'not_staff | staff_disabled | vendor_suspended | branch_closed | forbidden_role | forbidden_branch',
})
@UseGuards(StaffAuthGuard)
@Controller('vendor/images')
export class VendorImagesController {
  constructor(private readonly images: VendorImagesService) {}

  /** Any staff role: the vendor's menu pages and branch photos. */
  @Get()
  @ApiOkResponse({ type: [VendorImageResponseDto] })
  list(
    @CurrentStaff() ctx: StaffContext,
    @Query() query: ListVendorImagesQueryDto,
  ): Promise<VendorImageResponseDto[]> {
    return this.images.list(ctx, query);
  }

  /**
   * Add a menu page (vendor_admin) or a branch photo (vendor_admin: any branch, branchId
   * required; branch_manager: own branch). Stored as public WebP.
   */
  @Post()
  @StaffRoles('vendor_admin', 'branch_manager')
  @ApiImageUpload({
    kind: { type: 'string', enum: ['menu', 'branch_photo'] },
    branchId: { type: 'string', format: 'uuid', description: 'branch_photo only' },
  })
  @ApiCreatedResponse({ type: VendorImageResponseDto })
  @ApiConflictResponse({ description: 'too_many_images (20 menu pages, 3 photos per branch)' })
  create(
    @CurrentStaff() ctx: StaffContext,
    @Body() dto: CreateVendorImageDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<VendorImageResponseDto> {
    return this.images.create(ctx, dto, file.buffer);
  }

  /** Delete an image: its file is removed from storage. */
  @Delete(':id')
  @HttpCode(204)
  @StaffRoles('vendor_admin', 'branch_manager')
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'image_not_found' })
  remove(
    @CurrentStaff() ctx: StaffContext,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<void> {
    return this.images.remove(ctx, id);
  }
}
