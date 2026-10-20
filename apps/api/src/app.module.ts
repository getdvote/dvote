import { StorefrontFeedbackModule } from './storefront-feedback/storefront-feedback.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersApiModule } from './users/users-api.module';
import { StaffModule } from './staff/staff.module';
import { VendorsModule } from './vendors/vendors.module';
import { QrCodesModule } from './qr-codes/qr-codes.module';
import { ScansModule } from './scans/scans.module';
import { CardsModule } from './cards/cards.module';
import { FeedbackModule } from './feedback/feedback.module';
import { VendorImagesModule } from './vendor-images/vendor-images.module';
import { AdminModule } from './admin/admin.module';
import { BranchesModule } from './branches/branches.module';
import { PointRulesModule } from './point-rules/point-rules.module';
import { RewardsModule } from './rewards/rewards.module';
import { MerchantCustomersModule } from './merchant-customers/merchant-customers.module';
import { StorefrontModule } from './storefront/storefront.module';
import { ReportsModule } from './reports/vendor-summary';
import { LiveModule } from './live/live.module';
import { SystemModule } from './system/system.module';
import { FraudFlagsModule } from './fraud-flags/fraud-flags';
import { RateLimitModule } from './rate-limit/rate-limit';
import { PublicJoinModule } from './public-join/public-join.module';
import { BroadcastsModule } from './broadcasts/broadcasts';
import { AdminWorkspaceModule } from './admin/workspace.module';
import { LoyaltyCardsModule } from './loyalty-cards/loyalty-cards.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    RateLimitModule,
    PrismaModule,
    LiveModule,
    SystemModule,
    FraudFlagsModule,
    HealthModule,
    UsersApiModule,
    StaffModule,
    VendorsModule,
    QrCodesModule,
    ScansModule,
    CardsModule,
    FeedbackModule,
    StorefrontFeedbackModule,
    VendorImagesModule,
    AdminModule,
    BranchesModule,
    PointRulesModule,
    RewardsModule,
    ReportsModule,
    MerchantCustomersModule,
    StorefrontModule,
    LoyaltyCardsModule,
    PublicJoinModule,
    BroadcastsModule,
    AdminWorkspaceModule,
  ],
})
export class AppModule {}
