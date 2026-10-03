import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffAuthGuard, type StaffContext } from '../auth/staff-auth.guard';
import { StaffResponseDto } from './dto/staff-response.dto';
import { StaffService } from './staff.service';

@ApiTags('vendor: me')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'missing_token | invalid_token | token_expired',
})
@ApiForbiddenResponse({
  description: 'not_staff | staff_disabled | vendor_suspended | branch_closed',
})
@UseGuards(StaffAuthGuard)
@Controller('vendor/me')
export class VendorMeController {
  constructor(private readonly staff: StaffService) {}

  /** The signed-in staff member (any role). The dashboard uses it to pick menus by role. */
  @Get()
  @ApiOkResponse({ type: StaffResponseDto })
  async get(@CurrentStaff() ctx: StaffContext): Promise<StaffResponseDto> {
    return StaffResponseDto.from(await this.staff.get(ctx, ctx.staffId));
  }
}
