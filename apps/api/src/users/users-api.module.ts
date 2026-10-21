import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './users.controller';

/** Customer endpoints under /api/app/users (kept apart from UsersModule to avoid an import cycle with AuthModule). */
@Module({
  imports: [AuthModule],
  controllers: [UsersController],
})
export class UsersApiModule {}
