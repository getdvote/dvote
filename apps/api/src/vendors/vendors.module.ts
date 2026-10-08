import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StaffModule } from '../staff/staff.module';
import { StorageModule } from '../storage/storage.module';
import { AdminVendorsController } from './admin-vendors.controller';
import { VendorProfileController } from './vendor-profile.controller';
import { VendorsService } from './vendors.service';

/** Vendors: platform-admin management (/api/admin/vendors) and a vendor's own profile (/api/vendor/profile). */
@Module({
  imports: [AuthModule, StaffModule, StorageModule],
  controllers: [AdminVendorsController, VendorProfileController],
  providers: [VendorsService],
  exports: [VendorsService],
})
export class VendorsModule {}
