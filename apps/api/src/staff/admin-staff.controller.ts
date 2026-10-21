import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, PickType } from '@nestjs/swagger';
import { AdminApi } from '../auth/admin-api.decorator';
import { ParseUuidPipe } from '../common/uuid';
import { StaffResponseDto } from './dto/staff-response.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffService } from './staff.service';

/** Name and status only: role/branch moves stay with the vendor's own admins. */
export class AdminUpdateStaffDto extends PickType(UpdateStaffDto, ['name', 'status'] as const) {}

@AdminApi('admin: staff')
@Controller('admin')
export class AdminStaffController {
  constructor(private readonly staff: StaffService) {}

  /** Every staff account of a vendor (invite a vendor admin with POST /admin/vendors/{id}/admins). */
  @Get('vendors/:vendorId/staff')
  @ApiOkResponse({ type: [StaffResponseDto] })
  @ApiNotFoundResponse({ description: 'vendor_not_found' })
  async list(@Param('vendorId', ParseUuidPipe) vendorId: string): Promise<StaffResponseDto[]> {
    return (await this.staff.listForVendor(vendorId)).map((s) => StaffResponseDto.from(s));
  }

  /** Rename, or disable / re-enable (status). */
  @Patch('staff/:id')
  @ApiOkResponse({ type: StaffResponseDto })
  @ApiNotFoundResponse({ description: 'staff_not_found' })
  async update(@Param('id', ParseUuidPipe) id: string, @Body() dto: AdminUpdateStaffDto): Promise<StaffResponseDto> {
    return StaffResponseDto.from(await this.staff.adminUpdate(id, dto));
  }
}
