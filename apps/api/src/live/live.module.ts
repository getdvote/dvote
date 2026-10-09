import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module';
import { LiveInterceptor } from './live.interceptor';
import { LiveService } from './live.service';

/** Live updates to the customer app (WebSocket at /api/app/live). Global: any service can notify. */
@Global()
@Module({
  imports: [AuthModule],
  providers: [LiveService, { provide: APP_INTERCEPTOR, useClass: LiveInterceptor }],
  exports: [LiveService],
})
export class LiveModule {}
