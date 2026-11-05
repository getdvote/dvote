import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ScannerModule } from '../scanner/scanner.module';
import { ScansController } from './scans.controller';
import { ScansService } from './scans.service';

/** Staff scanning customer QR codes (/api/vendor/scans). */
@Module({
  imports: [AuthModule, ScannerModule],
  controllers: [ScansController],
  providers: [ScansService],
  exports: [ScansService],
})
export class ScansModule {}
