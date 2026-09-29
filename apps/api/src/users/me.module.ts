import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MeController } from './me.controller';

/** Customer profile endpoints (/api/app/me). */
@Module({
  imports: [AuthModule],
  controllers: [MeController],
})
export class MeModule {}
