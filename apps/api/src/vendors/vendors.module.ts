import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StaffModule } from '../staff/staff.module';
import { StorageModule } from '../storage/storage.module';
import { AdminVendorsController } from './admin-vendors.controller';
import { AppVendorsController } from './app-vendors.controller';
import { VendorProfileController } from './vendor-profile.controller';
import { VendorPageService } from './vendor-page.service';
import { VendorsService } from './vendors.service';

/** Vendors: platform-admin management (/api/admin/vendors) and a vendor's own profile (/api/vendor/profile). */
@Module({
  imports: [AuthModule, StaffModule, StorageModule],
  controllers: [AdminVendorsController, VendorProfileController, AppVendorsController],
  providers: [VendorsService, VendorPageService],
  exports: [VendorsService],
})
export class VendorsModule {}
