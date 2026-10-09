import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse } from '@nestjs/swagger';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffRoles, type StaffContext } from '../auth/staff-auth.guard';
import { VendorApi } from '../auth/vendor-api.decorator';
import { ParseUuidPipe } from '../common/uuid';
import { BranchesService } from './branches.service';
import { BranchResponseDto, CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

/** My vendor's branches (vendor dashboard). Reading: admins + managers; changing: vendor_admin. */
@VendorApi('vendor: branches')
@Controller('vendor/branches')
export class VendorBranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  @StaffRoles('vendor_admin', 'branch_manager')
  @ApiOkResponse({ type: [BranchResponseDto] })
  async list(@CurrentStaff() ctx: StaffContext): Promise<BranchResponseDto[]> {
    return (await this.branches.list(ctx.vendorId)).map((b) => BranchResponseDto.from(b));
  }

  @Post()
  @StaffRoles('vendor_admin')
  @ApiCreatedResponse({ type: BranchResponseDto })
  async create(@CurrentStaff() ctx: StaffContext, @Body() dto: CreateBranchDto): Promise<BranchResponseDto> {
    return BranchResponseDto.from(await this.branches.create(ctx.vendorId, dto));
  }

  @Patch(':id')
  @StaffRoles('vendor_admin')
  @ApiOkResponse({ type: BranchResponseDto })
  @ApiNotFoundResponse({ description: 'branch_not_found (also for other vendors’ branches)' })
  async update(
    @CurrentStaff() ctx: StaffContext,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpdateBranchDto,
  ): Promise<BranchResponseDto> {
    return BranchResponseDto.from(await this.branches.update(id, dto, ctx.vendorId));
  }
}
