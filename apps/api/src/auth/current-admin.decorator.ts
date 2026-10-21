import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AdminRequest } from './platform-admin.guard';

/** The AdminContext built by PlatformAdminGuard. Only valid on guarded routes. */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AdminRequest>().admin,
);
