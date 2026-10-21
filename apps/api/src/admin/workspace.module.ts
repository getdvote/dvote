import {
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Module,
  NestInterceptor,
  CallHandler,
  NotFoundException,
  UseInterceptors,
  type Type,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UUID_PATTERN } from '../common/uuid';
import { catchError, concatMap } from 'rxjs';
import { AuthModule } from '../auth/auth.module';
import {
  PlatformAdminGuard,
  type AdminRequest,
} from '../auth/platform-admin.guard';
import type { StaffRequest } from '../auth/staff-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { StaffController } from '../staff/staff.controller';
import { StaffModule } from '../staff/staff.module';
import { VendorProfileController } from '../vendors/vendor-profile.controller';
import { VendorsModule } from '../vendors/vendors.module';
import { VendorBranchesController } from '../branches/vendor-branches.controller';
import { BranchesModule } from '../branches/branches.module';
import { VendorPointRulesController } from '../point-rules/vendor-point-rules.controller';
import { PointRulesModule } from '../point-rules/point-rules.module';
import { VendorRewardsController } from '../rewards/vendor-rewards.controller';
import { RewardsModule } from '../rewards/rewards.module';
import { VendorImagesController } from '../vendor-images/vendor-images.controller';
import { VendorImagesModule } from '../vendor-images/vendor-images.module';
import {
  MerchantCustomersController,
  CustomerSegmentsController,
  MerchantCustomersModule,
} from '../merchant-customers/merchant-customers.module';
import {
  StorefrontController,
  StorefrontModule,
} from '../storefront/storefront.module';
import {
  StorefrontFeedbackController,
  StorefrontFeedbackModule,
} from '../storefront-feedback/storefront-feedback.module';
import {
  BroadcastsController,
  BroadcastsModule,
} from '../broadcasts/broadcasts';
import { ScansController } from '../scans/scans.controller';
import {
  LoyaltyCardController,
  LoyaltyCardsModule,
} from '../loyalty-cards/loyalty-cards.module';
import { ScansModule } from '../scans/scans.module';
import {
  ReportsModule,
  VendorSummaryController,
} from '../reports/vendor-summary';
import { VendorActivityController } from '../reports/vendor-activity';
import { VendorRedemptionsController } from '../reports/vendor-redemptions';
import { VendorInsightsController } from '../reports/vendor-insights';
import { VendorPatternsController } from '../reports/vendor-patterns';
import { VendorRewardPerformanceController } from '../reports/vendor-reward-performance';
import { VendorAttentionController } from '../reports/vendor-attention';
import { VendorGoLiveController } from '../reports/vendor-go-live';
import {
  AdminWorkspaceDataController,
  AdminWorkspaceDataService,
} from './workspace-data';

/** Runs only AFTER PlatformAdminGuard. Never borrows a merchant's staff identity. */
@Injectable()
export class AdminWorkspaceGuard implements CanActivate {
  constructor(private readonly db: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const req = context
      .switchToHttp()
      .getRequest<AdminRequest & StaffRequest>();
    const vendorId = req.params.workspaceVendorId as string;
    if (!req.admin?.adminId)
      throw new ForbiddenException({ code: 'not_admin' });
    if (!UUID_PATTERN.test(vendorId))
      throw new NotFoundException({ code: 'vendor_not_found' });
    const vendor = await this.db.vendors.findUnique({
      where: { id: vendorId },
      select: { status: true },
    });
    if (!vendor) throw new NotFoundException({ code: 'vendor_not_found' });
    if (
      req.path.includes('/workspace/scans') &&
      req.method !== 'GET' &&
      vendor.status !== 'active'
    )
      throw new ForbiddenException({ code: 'vendor_suspended' });
    req.staff = {
      staffId: req.admin.adminId,
      adminId: req.admin.adminId,
      vendorId,
      branchId: null,
      role: 'vendor_admin',
    };
    return true;
  }
}

/** Keep an actor/target/result audit, never a request body containing personal data or WiFi passwords. */
@Injectable()
export class AdminWorkspaceAudit implements NestInterceptor {
  constructor(private readonly db: PrismaService) {}
  async intercept(context: ExecutionContext, next: CallHandler) {
    const req = context
      .switchToHttp()
      .getRequest<AdminRequest & StaffRequest>();
    if (req.method === 'GET') return next.handle();
    const audit = await this.db.admin_actions.create({
      data: {
        admin_id: req.admin.adminId,
        vendor_id: req.staff.vendorId,
        method: req.method,
        path: req.path.slice(0, 300),
      },
    });
    return next.handle().pipe(
      concatMap(async (result) => {
        await this.db.admin_actions
          .update({ where: { id: audit.id }, data: { status: 'succeeded' } })
          .catch(() => undefined);
        return result;
      }),
      catchError(async (error: unknown) => {
        await this.db.admin_actions
          .update({ where: { id: audit.id }, data: { status: 'failed' } })
          .catch(() => undefined);
        throw error;
      }),
    );
  }
}

/** Reuse the exact DTO validation and tenant-scoped handlers; replace staff auth with admin+MFA. */
function workspaceController(Base: Type<object>, route: string) {
  class Scoped extends Base {}
  Object.defineProperty(Scoped, 'name', { value: `Platform${Base.name}` });
  Controller(`admin/vendors/:workspaceVendorId/workspace/${route}`)(Scoped);
  Reflect.defineMetadata(
    GUARDS_METADATA,
    [PlatformAdminGuard, AdminWorkspaceGuard],
    Scoped,
  );
  UseInterceptors(AdminWorkspaceAudit)(Scoped);
  return Scoped;
}

const controllers = [
  [StaffController, 'staff'],
  [VendorProfileController, 'profile'],
  [VendorBranchesController, 'branches'],
  [VendorPointRulesController, 'point-rules'],
  [VendorRewardsController, 'rewards'],
  [VendorImagesController, 'images'],
  [MerchantCustomersController, 'customers'],
  [CustomerSegmentsController, 'customer-segments'],
  [StorefrontController, 'storefront'],
  [LoyaltyCardController, 'loyalty-card'],
  [StorefrontFeedbackController, 'customer-feedback'],
  [BroadcastsController, 'broadcasts'],
  [ScansController, 'scans'],
  [VendorSummaryController, 'summary'],
  [VendorActivityController, 'events'],
  [VendorRedemptionsController, 'redemptions'],
  [VendorInsightsController, 'insights'],
  [VendorPatternsController, 'insights/patterns'],
  [VendorRewardPerformanceController, 'reward-performance'],
  [VendorAttentionController, 'attention'],
  [VendorGoLiveController, 'go-live'],
] as const;

@Module({
  imports: [
    AuthModule,
    StaffModule,
    VendorsModule,
    BranchesModule,
    PointRulesModule,
    RewardsModule,
    VendorImagesModule,
    MerchantCustomersModule,
    StorefrontModule,
    LoyaltyCardsModule,
    StorefrontFeedbackModule,
    BroadcastsModule,
    ScansModule,
    ReportsModule,
  ],
  controllers: [
    ...controllers.map(([controller, route]) =>
      workspaceController(controller, route),
    ),
    AdminWorkspaceDataController,
  ],
  providers: [
    AdminWorkspaceGuard,
    AdminWorkspaceAudit,
    AdminWorkspaceDataService,
  ],
})
export class AdminWorkspaceModule {}
