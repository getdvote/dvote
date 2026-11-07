import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { PlansModule } from '../plans/plans.module';
import { AdminDeleteShopController, AdminPlanController, PublicSignupController, SignupController } from './trial.controllers';
import { TurnstileService } from './turnstile.service';
import { EmailService } from './email.service';
import { BillingRemindersService } from './billing-reminders.service';
import { TrialService } from './trial.service';

/** Merchant self sign-up, the 14-day free trial, plan activation, billing reminders and deleting ended trials by hand. */
@Module({
  imports: [AuthModule, StorageModule, SupabaseModule, PlansModule],
  controllers: [SignupController, PublicSignupController, AdminPlanController, AdminDeleteShopController],
  providers: [TrialService, TurnstileService, EmailService, BillingRemindersService],
  exports: [TrialService],
})
export class TrialModule {}
