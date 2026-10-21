import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { CustomerRequest } from './customer-auth.guard';

/** The customer loaded by CustomerAuthGuard. Only valid on guarded routes. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<CustomerRequest>().user,
);
