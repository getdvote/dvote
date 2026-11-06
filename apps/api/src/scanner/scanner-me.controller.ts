import { Controller, Delete, Get, HttpCode, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiNoContentResponse, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffRoles, type StaffContext } from '../auth/staff-auth.guard';
import { StaffMeResponseDto } from '../staff/dto/staff-me-response.dto';
import { StaffService } from '../staff/staff.service';
import { AllowPausedSession, ScannerSessionGuard, type ScannerRequest } from './scanner-session.guard';
import { ScannerService } from './scanner.service';

/** A paired phone's own session. Only session tokens work here, never a staff sign-in. */
@ApiTags('vendor: paired phone')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'scanner_session_ended' })
@UseGuards(ScannerSessionGuard)
@StaffRoles('vendor_admin', 'branch_manager', 'staff')
@Controller('vendor/scanner/me')
export class ScannerMeController {
  constructor(
    private readonly staff: StaffService,
    private readonly scanner: ScannerService,
  ) {}

  /** What the Scan page needs, with the pairing's branch as the only branch. */
  @Get()
  @ApiOkResponse({ description: 'StaffMeResponseDto without email and vendor.plan' })
  @ApiForbiddenResponse({ description: 'vendor_suspended | trial_ended | subscription_expired | branch_closed' })
  async me(@CurrentStaff() ctx: StaffContext): Promise<Omit<StaffMeResponseDto, 'email' | 'vendor'> & { vendor: Omit<StaffMeResponseDto['vendor'], 'plan'> }> {
    const branch = await this.scanner.branchOf(ctx);
    // the person's own record: a merchant admin isn't in the pairing's branch
    const me = await this.staff.me({ ...ctx, branchId: ctx.role === 'vendor_admin' ? null : ctx.branchId });
    // only what the Scan page uses: not the person's email, nor the shop's plan and billing dates
    const { email: _email, ...person } = me;
    const { plan: _plan, ...vendor } = me.vendor;
    return { ...person, vendor, branchId: branch.id, branch, branches: [branch] };
  }

  /** End session. Also works while paused. */
  @Delete()
  @HttpCode(204)
  @AllowPausedSession()
  @ApiNoContentResponse()
  end(@Req() req: ScannerRequest): Promise<void> {
    return this.scanner.endByPhone(req.scannerPairingId);
  }
}
