import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/** Supabase Storage access (images). */
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
