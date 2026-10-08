import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminBranchesController } from './admin-branches.controller';
import { BranchesService } from './branches.service';

/** Branches (/api/admin/vendors/{id}/branches, /api/admin/branches/{id}); reused by the vendor dashboard later. */
@Module({
  imports: [AuthModule],
  controllers: [AdminBranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
