import { Controller, Get, Module } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { AdminApi } from '../auth/admin-api.decorator';
import { AuthModule } from '../auth/auth.module';
import { DatabaseStatsDto, SystemStatusDto } from './system.dto';
import { SystemService } from './system.service';

@AdminApi('admin: system')
@Controller('admin/system')
export class SystemController {
  constructor(private readonly system: SystemService) {}

  /** Database + storage sizes, connections, and the database server's RAM / disk / load. */
  @Get('database')
  @ApiOkResponse({ type: DatabaseStatsDto })
  database(): Promise<DatabaseStatsDto> {
    return this.system.database();
  }

  /** Is each part of dvote up: API, database, Supabase Auth + Storage, and the configured websites. */
  @Get('status')
  @ApiOkResponse({ type: SystemStatusDto })
  status(): Promise<SystemStatusDto> {
    return this.system.status();
  }
}

/** Platform health for platform admins (/api/admin/system). */
@Module({
  imports: [AuthModule],
  controllers: [SystemController],
  providers: [SystemService],
})
export class SystemModule {}
