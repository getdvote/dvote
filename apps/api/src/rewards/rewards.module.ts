import { AppRewardsController } from './app-rewards.controller';
import { VendorRewardsController } from './vendor-rewards.controller';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { AdminRewardsController } from './admin-rewards.controller';
import { RewardsService } from './rewards.service';

/** Reward catalogue (/api/admin/vendors/{id}/rewards, /api/admin/rewards/{id}); and /api/vendor/rewards for the vendor dashboard. */
@Module({
  imports: [AuthModule, StorageModule],
  controllers: [AdminRewardsController, VendorRewardsController, AppRewardsController],
  providers: [RewardsService],
  exports: [RewardsService],
})
export class RewardsModule {}
