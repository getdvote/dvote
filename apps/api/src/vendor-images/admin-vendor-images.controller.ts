import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UploadedFile } from '@nestjs/common';
import { ApiConflictResponse, ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse } from '@nestjs/swagger';
import { AdminApi } from '../auth/admin-api.decorator';
import { ParseUuidPipe } from '../common/uuid';
import { ApiImageUpload } from '../storage/api-image-upload.decorator';
import { CreateVendorImageDto } from './dto/create-vendor-image.dto';
import { ListVendorImagesQueryDto } from './dto/list-vendor-images-query.dto';
import { VendorImageResponseDto } from './dto/vendor-image-response.dto';
import { VendorImagesService } from './vendor-images.service';

/** Any vendor's menu pages and branch photos, for platform admins (same rules as a vendor admin). */
@AdminApi('admin: images')
@Controller('admin/vendors/:vendorId/images')
export class AdminVendorImagesController {
  constructor(private readonly images: VendorImagesService) {}

  @Get()
  @ApiOkResponse({ type: [VendorImageResponseDto] })
  @ApiNotFoundResponse({ description: 'vendor_not_found' })
  async list(
    @Param('vendorId', ParseUuidPipe) vendorId: string,
    @Query() query: ListVendorImagesQueryDto,
  ): Promise<VendorImageResponseDto[]> {
    return this.images.list(await this.images.adminContext(vendorId), query);
  }

  /** Add a menu page (kind menu) or a branch photo (kind branch_photo + branchId). */
  @Post()
  @ApiImageUpload({
    kind: { type: 'string', enum: ['menu', 'branch_photo'] },
    branchId: { type: 'string', format: 'uuid', description: 'branch_photo only' },
  })
  @ApiCreatedResponse({ type: VendorImageResponseDto })
  @ApiNotFoundResponse({ description: 'vendor_not_found' })
  @ApiConflictResponse({ description: 'too_many_images' })
  async create(
    @Param('vendorId', ParseUuidPipe) vendorId: string,
    @Body() dto: CreateVendorImageDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<VendorImageResponseDto> {
    return this.images.create(await this.images.adminContext(vendorId), dto, file.buffer);
  }

  /** Delete an image: its file is removed from storage. */
  @Delete(':imageId')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'vendor_not_found | image_not_found' })
  async remove(
    @Param('vendorId', ParseUuidPipe) vendorId: string,
    @Param('imageId', ParseUuidPipe) imageId: string,
  ): Promise<void> {
    await this.images.remove(await this.images.adminContext(vendorId), imageId);
  }
}
