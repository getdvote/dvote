/**
 * Creates the Supabase Storage buckets the API uses (safe to run again):
 *   vendors  public   logos, menu pages, branch photos
 *   avatars  private  customer photos
 *
 *   npm run storage:setup
 *
 * Needs SUPABASE_URL and SUPABASE_SECRET_KEY in apps/api/.env.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { StorageService } from '../storage/storage.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    for (const line of await app.get(StorageService).ensureBuckets()) {
      console.log(line);
    }
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  console.error('Failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
