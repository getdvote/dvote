import { applyDecorators, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PlatformAdminGuard } from './platform-admin.guard';

/** Everything an /api/admin controller needs: the platform-admin guard and its Swagger docs. */
export function AdminApi(tag: string) {
  return applyDecorators(
    ApiTags(tag),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'missing_token | invalid_token | token_expired' }),
    ApiForbiddenResponse({ description: 'not_admin | admin_disabled | mfa_required' }),
    UseGuards(PlatformAdminGuard),
  );
}
