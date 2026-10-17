import { StorageModule } from '../storage/storage.module';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WalletModule } from '../wallet/wallet.module';
import { PublicJoinController } from './public-join.controller';
import { PublicJoinService } from './public-join.service';

/** Public web site API (/api/public): venue page, join a merchant, card page. */
@Module({
  imports: [AuthModule, WalletModule, StorageModule],
  controllers: [PublicJoinController],
  providers: [PublicJoinService],
})
export class PublicJoinModule {}
