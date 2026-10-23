import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminFoundingController, PublicPlansController } from './plans.controllers';
import { PlansService } from './plans.service';
import { EntitlementsService } from './entitlements.service';

/** dvote's plans and prices, the Founding Merchants counter and what each plan includes (global). */
@Global()
@Module({
  imports: [AuthModule],
  controllers: [PublicPlansController, AdminFoundingController],
  providers: [PlansService, EntitlementsService],
  exports: [PlansService, EntitlementsService],
})
export class PlansModule {}
