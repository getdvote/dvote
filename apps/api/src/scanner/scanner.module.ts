import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PublicScannerPairingsController, VendorScannerPairingsController } from './scanner.controllers';
import { StaffModule } from '../staff/staff.module';
import { ScannerMeController } from './scanner-me.controller';
import { ScannerSessionGuard, StaffOrScannerGuard } from './scanner-session.guard';
import { ScannerService } from './scanner.service';

/** Pairing a phone to scan without a sign-in (/api/vendor/scanner-pairings, /api/public/scanner-pairings). */
@Module({
  imports: [AuthModule, StaffModule],
  controllers: [VendorScannerPairingsController, PublicScannerPairingsController, ScannerMeController],
  providers: [ScannerService, ScannerSessionGuard, StaffOrScannerGuard],
  exports: [ScannerService, ScannerSessionGuard, StaffOrScannerGuard],
})
export class ScannerModule {}
