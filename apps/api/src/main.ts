import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './app.setup';
import { Env } from './config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  configureApp(app);

  const origins = config.get('CORS_ORIGINS', { infer: true });
  if (origins) {
    app.enableCors({ origin: origins.split(',').map((o) => o.trim()) });
  }

  // Public pages shown inside the apps (e.g. /legal/terms.html in the customer app), served in
  // every environment so they can be edited and redeployed without a new app release.
  app.useStaticAssets(join(__dirname, '..', 'public'));

  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    setupSwagger(app);
    // Temporary sign-in test page (dev-public/login.html) until the real apps exist.
    app.useStaticAssets(join(__dirname, '..', 'dev-public'), {
      prefix: '/dev',
    });
  }

  await app.listen(config.get('PORT', { infer: true }));
}
void bootstrap();
