import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminFoundingController, PublicPlansController } from './plans.controllers';
import { PlansService } from './plans.service';

/** dvote's plans and prices, and the Founding Merchants counter. */
@Module({
  imports: [AuthModule],
  controllers: [PublicPlansController, AdminFoundingController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
