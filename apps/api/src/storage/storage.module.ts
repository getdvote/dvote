import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { WalletLogoService } from './wallet-logo.service';

/** Supabase Storage access (images). */
@Module({
  providers: [StorageService, WalletLogoService],
  exports: [StorageService, WalletLogoService],
})
export class StorageModule {}
