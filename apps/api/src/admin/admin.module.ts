import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { QrStatsService } from './qr-stats';
import { AdminService } from './admin.service';

/** Platform admin: who am I, overview numbers, customers (/api/admin/me, /overview, /users). */
@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService, QrStatsService],
})
export class AdminModule {}
