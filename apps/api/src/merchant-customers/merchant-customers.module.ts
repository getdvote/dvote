import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiConflictResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse } from '@nestjs/swagger';
import { AuthModule } from '../auth/auth.module';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffRoles, type StaffContext } from '../auth/staff-auth.guard';
import { VendorApi } from '../auth/vendor-api.decorator';
import { ParseUuidPipe } from '../common/uuid';
import {
  CreateCustomerSegmentDto,
  CustomerExportDto,
  CustomerListQuery,
  CustomerScopeQuery,
  CustomSegmentDto,
  MerchantCustomerListDto,
  MerchantCustomerDetailDto,
  SegmentPreviewDto,
  SegmentPreviewResultDto,
  UpdateCustomerSegmentDto,
} from './customer.dto';
import { MerchantCustomersService } from './merchant-customers.service';

@VendorApi('vendor: customers')
@StaffRoles('vendor_admin', 'branch_manager', 'viewer')
@Controller('vendor/customers')
export class MerchantCustomersController {
  constructor(private readonly customers: MerchantCustomersService) {}

  @Get()
  @ApiOkResponse({ type: MerchantCustomerListDto })
  list(@CurrentStaff() ctx: StaffContext, @Query() q: CustomerListQuery) {
    return this.customers.list(ctx, q);
  }

  /** The filtered list without paging, with email and phone, for a CSV download. */
  @Get('export')
  @StaffRoles('vendor_admin')
  @ApiOkResponse({ type: CustomerExportDto })
  export(@CurrentStaff() ctx: StaffContext, @Query() q: CustomerListQuery) {
    return this.customers.export(ctx, q);
  }

  @Get(':id')
  @ApiOkResponse({ type: MerchantCustomerDetailDto })
  @ApiNotFoundResponse({
    description:
      'customer_not_found (including customers outside the merchant or branch)',
  })
  detail(
    @CurrentStaff() ctx: StaffContext,
    @Param('id', ParseUuidPipe) id: string,
    @Query() q: CustomerScopeQuery,
  ) {
    return this.customers.detail(ctx, id, q);
  }
}

/** Custom segments: everyone in the customers page can count with them, merchant admins change them. */
@VendorApi('vendor: customers')
@StaffRoles('vendor_admin', 'branch_manager', 'viewer')
@Controller('vendor/customer-segments')
export class CustomerSegmentsController {
  constructor(private readonly customers: MerchantCustomersService) {}

  @Post('preview')
  @HttpCode(200)
  @ApiOkResponse({ type: SegmentPreviewResultDto })
  preview(@CurrentStaff() ctx: StaffContext, @Body() dto: SegmentPreviewDto) {
    return this.customers.previewSegment(ctx, dto);
  }

  @Post()
  @StaffRoles('vendor_admin')
  @ApiOkResponse({ type: CustomSegmentDto })
  @ApiConflictResponse({ description: 'segment_name_taken' })
  create(@CurrentStaff() ctx: StaffContext, @Body() dto: CreateCustomerSegmentDto) {
    return this.customers.createSegment(ctx, dto);
  }

  @Patch(':id')
  @StaffRoles('vendor_admin')
  @ApiOkResponse({ type: CustomSegmentDto })
  @ApiNotFoundResponse({ description: 'segment_not_found' })
  @ApiConflictResponse({ description: 'segment_name_taken' })
  update(@CurrentStaff() ctx: StaffContext, @Param('id', ParseUuidPipe) id: string, @Body() dto: UpdateCustomerSegmentDto) {
    return this.customers.updateSegment(ctx, id, dto);
  }

  @Delete(':id')
  @StaffRoles('vendor_admin')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Archived' })
  @ApiNotFoundResponse({ description: 'segment_not_found' })
  archive(@CurrentStaff() ctx: StaffContext, @Param('id', ParseUuidPipe) id: string) {
    return this.customers.archiveSegment(ctx, id);
  }

  @Put(':id/members/:cardId')
  @StaffRoles('vendor_admin')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Added by hand (and taken out of any other hand-made segment)' })
  @ApiNotFoundResponse({ description: 'segment_not_found, customer_not_found' })
  add(
    @CurrentStaff() ctx: StaffContext,
    @Param('id', ParseUuidPipe) id: string,
    @Param('cardId', ParseUuidPipe) cardId: string,
  ) {
    return this.customers.addMember(ctx, id, cardId);
  }

  @Delete(':id/members/:cardId')
  @StaffRoles('vendor_admin')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Removed by hand (stays out even when the rules match)' })
  @ApiNotFoundResponse({ description: 'segment_not_found, customer_not_found' })
  remove(
    @CurrentStaff() ctx: StaffContext,
    @Param('id', ParseUuidPipe) id: string,
    @Param('cardId', ParseUuidPipe) cardId: string,
  ) {
    return this.customers.removeMember(ctx, id, cardId);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [MerchantCustomersController, CustomerSegmentsController],
  providers: [MerchantCustomersService],
})
export class MerchantCustomersModule {}
