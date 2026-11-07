import { Body, Controller, Delete, Get, HttpCode, Module, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiConflictResponse, ApiOkResponse } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AdminApi } from '../auth/admin-api.decorator';
import { AuthModule } from '../auth/auth.module';
import { CurrentAdmin } from '../auth/current-admin.decorator';
import { CurrentStaff } from '../auth/current-staff.decorator';
import type { AdminContext } from '../auth/platform-admin.guard';
import { StaffRoles, type StaffContext } from '../auth/staff-auth.guard';
import { VendorApi } from '../auth/vendor-api.decorator';
import { IsUuid, ParseUuidPipe } from '../common/uuid';
import { BILLING_CYCLES, PLANS, type BillingCycle, type Plan } from '../plans/plans';
import { BillingService } from './billing.service';
import { PlanRequestsService, type RequestStatus } from './plan-requests.service';

export class ChangePlanDto {
  @IsIn(PLANS) plan: Plan;
  @IsIn(BILLING_CYCLES) billingCycle: BillingCycle;
  /** Branches the plan should cover (default: what it covers now). */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) branches?: number;
  /** Downgrade below what is open: the branches / rewards that stay. */
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsUuid({ each: true }) keepBranchIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsUuid({ each: true }) keepRewardIds?: string[];
}

export class ReviewRequestDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class ListPlanRequestsDto {
  @IsOptional() @IsIn(['pending', 'approved', 'rejected', 'cancelled', 'all']) status?: RequestStatus | 'all';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

/** /api/vendor/billing: the merchant admin's Billing page (Settings → Billing). */
@VendorApi('vendor: billing')
@Controller('vendor/billing')
@StaffRoles('vendor_admin')
export class VendorBillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @ApiOkResponse({ description: 'Current plan, price, renewal / trial dates, pending request, scheduled change, all plans priced' })
  get(@CurrentStaff() ctx: StaffContext) {
    return this.billing.get(ctx.vendorId);
  }

  /** What a change would be (upgrade / downgrade / cycle) and cost now, without sending it. */
  @Post('preview')
  @HttpCode(200)
  @ApiBadRequestResponse({ description: 'split_change | no_change | keep_required | invalid_keep | invalid_branches' })
  preview(@CurrentStaff() ctx: StaffContext, @Body() dto: ChangePlanDto) {
    return this.billing.preview(ctx.vendorId, dto);
  }

  /** On a trial: save the pick. On a paid plan: send a request to dvote (approved after payment). */
  @Put('plan')
  @ApiOkResponse({ description: 'The billing page after the change (pendingRequest on a paid plan)' })
  @ApiBadRequestResponse({ description: 'split_change | no_change | keep_required | invalid_keep | invalid_branches' })
  @ApiConflictResponse({ description: 'request_pending' })
  change(@CurrentStaff() ctx: StaffContext, @Body() dto: ChangePlanDto) {
    return this.billing.change(ctx.vendorId, ctx.staffId, dto);
  }

  @Delete('request')
  @ApiConflictResponse({ description: 'no_pending_request' })
  cancelRequest(@CurrentStaff() ctx: StaffContext) {
    return this.billing.cancelRequest(ctx.vendorId);
  }

  @Delete('scheduled')
  @ApiConflictResponse({ description: 'nothing_scheduled' })
  cancel(@CurrentStaff() ctx: StaffContext) {
    return this.billing.cancelScheduled(ctx.vendorId);
  }
}

/** /api/admin/plan-requests: the dvote team approves or rejects merchants' plan changes. */
@AdminApi('admin: plan requests')
@Controller('admin/plan-requests')
export class AdminPlanRequestsController {
  constructor(private readonly requests: PlanRequestsService) {}

  @Get()
  list(@Query() q: ListPlanRequestsDto) {
    return this.requests.list(q.status ?? 'pending', q.page ?? 1, q.pageSize ?? 20);
  }

  /** Take the money first: an upgrade starts now; a downgrade / cycle switch at the end of the period. */
  @Post(':id/approve')
  @HttpCode(200)
  @ApiConflictResponse({ description: 'request_not_pending | request_outdated | not_active' })
  approve(@Param('id', ParseUuidPipe) id: string, @CurrentAdmin() admin: AdminContext, @Body() dto: ReviewRequestDto) {
    return this.requests.approve(id, admin.adminId, dto.note?.trim() || null);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiConflictResponse({ description: 'request_not_pending' })
  reject(@Param('id', ParseUuidPipe) id: string, @CurrentAdmin() admin: AdminContext, @Body() dto: ReviewRequestDto) {
    return this.requests.reject(id, admin.adminId, dto.note?.trim() || null);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [VendorBillingController, AdminPlanRequestsController],
  providers: [BillingService, PlanRequestsService],
  exports: [BillingService],
})
export class BillingModule {}
