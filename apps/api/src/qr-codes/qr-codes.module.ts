import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QrCodesController } from './qr-codes.controller';
import { QrCodesService } from './qr-codes.service';

/** Customer one-time QR codes (/api/app/qr-codes). */
@Module({
  imports: [AuthModule],
  controllers: [QrCodesController],
  providers: [QrCodesService],
})
export class QrCodesModule {}
