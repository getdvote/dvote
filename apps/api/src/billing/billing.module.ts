import { Body, Controller, Delete, Get, Module, Put } from '@nestjs/common';
import { ApiConflictResponse, ApiOkResponse } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { AuthModule } from '../auth/auth.module';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffRoles, type StaffContext } from '../auth/staff-auth.guard';
import { VendorApi } from '../auth/vendor-api.decorator';
import { BILLING_CYCLES, PLANS, type BillingCycle, type Plan } from '../plans/plans';
import { BillingService } from './billing.service';

export class ChangePlanDto {
  @IsIn(PLANS) plan: Plan;
  @IsIn(BILLING_CYCLES) billingCycle: BillingCycle;
}

/** /api/vendor/billing: the merchant admin's Billing page (Settings → Billing). */
@VendorApi('vendor: billing')
@Controller('vendor/billing')
@StaffRoles('vendor_admin')
export class VendorBillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @ApiOkResponse({ description: 'Current plan, price for the open branches, renewal / trial dates, scheduled change, all plans priced' })
  get(@CurrentStaff() ctx: StaffContext) {
    return this.billing.get(ctx.vendorId);
  }

  /** Upgrade (at once) or downgrade / switch cycle (at the end of the paid period). */
  @Put('plan')
  @ApiOkResponse({ description: 'The billing page after the change' })
  change(@CurrentStaff() ctx: StaffContext, @Body() dto: ChangePlanDto) {
    return this.billing.change(ctx.vendorId, dto.plan, dto.billingCycle);
  }

  @Delete('scheduled')
  @ApiConflictResponse({ description: 'nothing_scheduled' })
  cancel(@CurrentStaff() ctx: StaffContext) {
    return this.billing.cancelScheduled(ctx.vendorId);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [VendorBillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
