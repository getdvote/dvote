import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AdminStaffController } from './admin-staff.controller';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

/** Vendor staff: /api/vendor/staff (incl. /staff/me). */
@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [StaffController, AdminStaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
