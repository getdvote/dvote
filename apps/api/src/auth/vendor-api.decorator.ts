import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { StaffAuthGuard } from './staff-auth.guard';

/**
 * An /api/vendor controller for the vendor dashboard: staff sign-in, and every query scoped
 * to the signed-in person's vendor (StaffContext) — never to an id sent by the browser.
 */
export function VendorApi(tag: string) {
  return applyDecorators(
    ApiTags(tag),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'missing_token | invalid_token | token_expired' }),
    ApiForbiddenResponse({
      description: 'not_staff | staff_disabled | vendor_suspended | branch_closed | forbidden_role',
    }),
    UseGuards(StaffAuthGuard),
  );
}
