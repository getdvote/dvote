import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBadRequestResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse } from '@nestjs/swagger';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffRoles, type StaffContext } from '../auth/staff-auth.guard';
import { VendorApi } from '../auth/vendor-api.decorator';
import { ParseUuidPipe } from '../common/uuid';
import { BranchesService } from './branches.service';
import { BranchResponseDto, CreateBranchDto, PauseBranchDto, UpdateBranchDto } from './dto/branch.dto';

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

  /** Temporarily closed until a time (manager: own branch; admin: any). Ends by itself. */
  @Put(':id/pause')
  @StaffRoles('vendor_admin', 'branch_manager')
  @ApiOkResponse({ type: BranchResponseDto })
  @ApiBadRequestResponse({ description: 'until_in_past | until_too_far' })
  @ApiForbiddenResponse({ description: 'forbidden_branch (a manager pausing another branch)' })
  @ApiNotFoundResponse({ description: 'branch_not_found' })
  async pause(
    @CurrentStaff() ctx: StaffContext,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: PauseBranchDto,
  ): Promise<BranchResponseDto> {
    return BranchResponseDto.from(await this.branches.setPause(ctx, id, dto.until));
  }

  /** Open again now. */
  @Delete(':id/pause')
  @StaffRoles('vendor_admin', 'branch_manager')
  @ApiOkResponse({ type: BranchResponseDto })
  @ApiNotFoundResponse({ description: 'branch_not_found' })
  async resume(@CurrentStaff() ctx: StaffContext, @Param('id', ParseUuidPipe) id: string): Promise<BranchResponseDto> {
    return BranchResponseDto.from(await this.branches.setPause(ctx, id, null));
  }
}
