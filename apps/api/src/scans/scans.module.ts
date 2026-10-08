import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ScansController } from './scans.controller';
import { ScansService } from './scans.service';

/** Staff scanning customer QR codes (/api/vendor/scans). */
@Module({
  imports: [AuthModule],
  controllers: [ScansController],
  providers: [ScansService],
})
export class ScansModule {}
