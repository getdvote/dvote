import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse } from '@nestjs/swagger';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffRoles, type StaffContext } from '../auth/staff-auth.guard';
import { VendorApi } from '../auth/vendor-api.decorator';
import { CreatePointRuleDto, PointRuleResponseDto } from './dto/point-rule.dto';
import { PointRulesService } from './point-rules.service';

/** My vendor's earning rule (vendor dashboard). Reading: admins + managers; publishing: vendor_admin. */
@VendorApi('vendor: point rules')
@Controller('vendor/point-rules')
export class VendorPointRulesController {
  constructor(private readonly rules: PointRulesService) {}

  @Get()
  @StaffRoles('vendor_admin', 'branch_manager')
  @ApiOkResponse({ type: [PointRuleResponseDto] })
  async list(@CurrentStaff() ctx: StaffContext): Promise<PointRuleResponseDto[]> {
    return (await this.rules.list(ctx.vendorId)).map((r) => PointRuleResponseDto.from(r));
  }

  /** Publish a new version (recorded as created by this staff member). */
  @Post()
  @StaffRoles('vendor_admin')
  @ApiCreatedResponse({ type: PointRuleResponseDto })
  async publish(@CurrentStaff() ctx: StaffContext, @Body() dto: CreatePointRuleDto): Promise<PointRuleResponseDto> {
    return PointRuleResponseDto.from(await this.rules.publish(ctx.vendorId, dto, ctx.staffId));
  }

  @Delete('active')
  @HttpCode(204)
  @StaffRoles('vendor_admin')
  @ApiNoContentResponse()
  async deactivate(@CurrentStaff() ctx: StaffContext): Promise<void> {
    await this.rules.deactivate(ctx.vendorId);
  }
}
