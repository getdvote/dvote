import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { VendorImagesController } from './vendor-images.controller';
import { VendorImagesService } from './vendor-images.service';

/** Menu pages and branch photos (/api/vendor/images). */
@Module({
  imports: [AuthModule, StorageModule],
  controllers: [VendorImagesController],
  providers: [VendorImagesService],
})
export class VendorImagesModule {}
