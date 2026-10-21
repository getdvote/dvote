import { VendorPointRulesController } from './vendor-point-rules.controller';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminPointRulesController } from './admin-point-rules.controller';
import { PointRulesService } from './point-rules.service';

/** Versioned earning rules (/api/admin/vendors/{id}/point-rules); reused by the vendor dashboard later. */
@Module({
  imports: [AuthModule],
  controllers: [AdminPointRulesController, VendorPointRulesController],
  providers: [PointRulesService],
  exports: [PointRulesService],
})
export class PointRulesModule {}
