import { Module } from '@nestjs/common';
import { GoogleWalletService } from './google-wallet.service';
import { StorageModule } from '../storage/storage.module';

/** Wallet passes for the loyalty cards (Google now; Apple later). */
@Module({ imports: [StorageModule], providers: [GoogleWalletService], exports: [GoogleWalletService] })
export class WalletModule {}
