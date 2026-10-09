import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse } from '@nestjs/swagger';
import { AdminApi } from '../auth/admin-api.decorator';
import { ParseUuidPipe } from '../common/uuid';
import { BranchesService } from './branches.service';
import { BranchResponseDto, CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

@AdminApi('admin: branches')
@Controller('admin')
export class AdminBranchesController {
  constructor(private readonly branches: BranchesService) {}

  /** All branches of a vendor (open first). */
  @Get('vendors/:vendorId/branches')
  @ApiOkResponse({ type: [BranchResponseDto] })
  @ApiNotFoundResponse({ description: 'vendor_not_found' })
  async list(@Param('vendorId', ParseUuidPipe) vendorId: string): Promise<BranchResponseDto[]> {
    return (await this.branches.list(vendorId)).map((b) => BranchResponseDto.from(b));
  }

  @Post('vendors/:vendorId/branches')
  @ApiCreatedResponse({ type: BranchResponseDto })
  @ApiNotFoundResponse({ description: 'vendor_not_found' })
  async create(
    @Param('vendorId', ParseUuidPipe) vendorId: string,
    @Body() dto: CreateBranchDto,
  ): Promise<BranchResponseDto> {
    return BranchResponseDto.from(await this.branches.create(vendorId, dto));
  }

  /** Edit, or close / reopen (status). */
  @Patch('branches/:id')
  @ApiOkResponse({ type: BranchResponseDto })
  @ApiNotFoundResponse({ description: 'branch_not_found' })
  async update(@Param('id', ParseUuidPipe) id: string, @Body() dto: UpdateBranchDto): Promise<BranchResponseDto> {
    return BranchResponseDto.from(await this.branches.update(id, dto));
  }
}
