import { VendorRewardsController } from './vendor-rewards.controller';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminRewardsController } from './admin-rewards.controller';
import { RewardsService } from './rewards.service';

/** Reward catalogue (/api/admin/vendors/{id}/rewards, /api/admin/rewards/{id}); reused by the vendor dashboard later. */
@Module({
  imports: [AuthModule],
  controllers: [AdminRewardsController, VendorRewardsController],
  providers: [RewardsService],
  exports: [RewardsService],
})
export class RewardsModule {}
