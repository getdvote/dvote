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
import { ReportsModule } from './reports/vendor-summary';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    UsersApiModule,
    StaffModule,
    VendorsModule,
    QrCodesModule,
    ScansModule,
    CardsModule,
    FeedbackModule,
    VendorImagesModule,
    AdminModule,
    BranchesModule,
    PointRulesModule,
    RewardsModule,
    ReportsModule,
  ],
})
export class AppModule {}
