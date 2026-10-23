import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { PlansModule } from '../plans/plans.module';
import { AdminPlanController, PublicSignupController, SignupController } from './trial.controllers';
import { TurnstileService } from './turnstile.service';
import { TrialService } from './trial.service';

/** Merchant self sign-up, the 14-day free trial, plan activation and deletion of unpaid trials. */
@Module({
  imports: [AuthModule, StorageModule, SupabaseModule, PlansModule],
  controllers: [SignupController, PublicSignupController, AdminPlanController],
  providers: [TrialService, TurnstileService],
  exports: [TrialService],
})
export class TrialModule {}
