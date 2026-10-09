import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import type { StaffContext } from '../auth/staff-auth.guard';
import { LiveService } from './live.service';

/** Dashboard writes that change what customers see. Staff accounts and scans don't. */
const DASHBOARD_WRITE = /^\/api\/(admin|vendor)\//;
const NOT_FOR_CUSTOMERS = /^\/api\/(vendor\/(scans|staff)|admin\/(staff|users|me))(\/|$)|\/admins$/;
const ADMIN_VENDOR = /^\/api\/admin\/vendors\/([0-9a-fA-F-]{36})(\/|$)/;

/**
 * After any successful change made from the admin or vendor dashboard (POST / PATCH / PUT /
 * DELETE on /api/admin or /api/vendor), tells the connected customer apps which shop changed,
 * so they re-read it at once instead of waiting for their next refresh.
 */
@Injectable()
export class LiveInterceptor implements NestInterceptor {
  constructor(private readonly live: LiveService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<Request & { staff?: StaffContext }>();
    const path = req.path;
    if (req.method === 'GET' || !DASHBOARD_WRITE.test(path) || NOT_FOR_CUSTOMERS.test(path)) return next.handle();

    return next.handle().pipe(
      tap(() => {
        // vendor dashboard: the staff's own vendor; admin: the vendor in the URL, when there is one
        const vendorId = req.staff?.vendorId ?? (req.params?.vendorId as string | undefined) ?? path.match(ADMIN_VENDOR)?.[1] ?? null;
        this.live.vendorChanged(vendorId);
      }),
    );
  }
}
