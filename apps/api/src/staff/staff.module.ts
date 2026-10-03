import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { VendorMeController } from './vendor-me.controller';

/** Vendor staff: /api/vendor/me and /api/vendor/staff. */
@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [VendorMeController, StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
