import { Module } from '@nestjs/common';
import { GoogleWalletService } from './google-wallet.service';

/** Wallet passes for the loyalty cards (Google now; Apple later). */
@Module({ providers: [GoogleWalletService], exports: [GoogleWalletService] })
export class WalletModule {}
