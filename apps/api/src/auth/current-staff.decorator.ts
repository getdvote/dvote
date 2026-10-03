import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { StaffRequest } from './staff-auth.guard';

/** The StaffContext built by StaffAuthGuard. Only valid on guarded routes. */
export const CurrentStaff = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<StaffRequest>().staff,
);
