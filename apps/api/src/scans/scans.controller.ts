import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffAuthGuard, type StaffContext } from '../auth/staff-auth.guard';
import { CollectScanDto, PreviewScanDto } from './dto/scan.dto';
import {
  CollectResponseDto,
  PreviewScanResponseDto,
} from './dto/scan-response.dto';
import { ScansService } from './scans.service';

/** Used by the staff app after scanning a customer's QR. All staff roles. */
@ApiTags('vendor: scans')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'missing_token | invalid_token | token_expired',
})
@UseGuards(StaffAuthGuard)
@Controller('vendor/scans')
export class ScansController {
  constructor(private readonly scans: ScansService) {}

  /** What the QR is and whether it can be used here. Changes nothing. */
  @Post('preview')
  @HttpCode(200)
  @ApiOkResponse({ type: PreviewScanResponseDto })
  @ApiNotFoundResponse({ description: 'qr_invalid' })
  preview(
    @CurrentStaff() ctx: StaffContext,
    @Body() dto: PreviewScanDto,
  ): Promise<PreviewScanResponseDto> {
    return this.scans.preview(ctx, dto.code);
  }

  /** Enter the receipt total: the server computes and adds the points. */
  @Post('collect')
  @HttpCode(200)
  @ApiOkResponse({ type: CollectResponseDto })
  @ApiNotFoundResponse({ description: 'qr_invalid' })
  @ApiBadRequestResponse({
    description:
      'wrong_qr_type | branch_required | invalid_branch | validation errors',
  })
  @ApiForbiddenResponse({
    description:
      'forbidden_branch | user_blocked | not_staff | staff_disabled | vendor_suspended | branch_closed',
  })
  @ApiConflictResponse({
    description:
      'qr_used | qr_expired | qr_cancelled | no_active_rule | duplicate_receipt | idempotency_key_reused',
  })
  @ApiUnprocessableEntityResponse({ description: 'no_points_earned' })
  collect(
    @CurrentStaff() ctx: StaffContext,
    @Body() dto: CollectScanDto,
  ): Promise<CollectResponseDto> {
    return this.scans.collect(ctx, dto);
  }
}
