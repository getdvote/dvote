import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse } from '@nestjs/swagger';
import { AdminApi } from '../auth/admin-api.decorator';
import { CurrentAdmin } from '../auth/current-admin.decorator';
import type { AdminContext } from '../auth/platform-admin.guard';
import { ParseUuidPipe } from '../common/uuid';
import { AdminService } from './admin.service';
import { QrSourcesQueryDto, QrSourcesResponseDto, QrStatsService } from './qr-stats';
import {
  AdminMeResponseDto,
  AdminUserDetailDto,
  AdminUserListDto,
  ListUsersQueryDto,
  OverviewResponseDto,
  UpdateUserStatusDto,
} from './dto/admin.dto';

@AdminApi('admin: overview & customers')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly qrStats: QrStatsService,
  ) {}

  /** The signed-in platform admin (the dashboard calls this after sign-in). */
  @Get('me')
  @ApiOkResponse({ type: AdminMeResponseDto })
  me(@CurrentAdmin() ctx: AdminContext): Promise<AdminMeResponseDto> {
    return this.admin.me(ctx.adminId);
  }

  /** Collects split by master QR (any shop) vs shop QR (made on a shop page), last N days. */
  @Get('stats/qr-sources')
  @ApiOkResponse({ type: QrSourcesResponseDto })
  qrSources(@Query() q: QrSourcesQueryDto): Promise<QrSourcesResponseDto> {
    return this.qrStats.qrSources(q.days ?? 30);
  }

  /** Dashboard home: totals, the last 14 days, the busiest shops. */
  @Get('overview')
  @ApiOkResponse({ type: OverviewResponseDto })
  overview(): Promise<OverviewResponseDto> {
    return this.admin.overview();
  }

  /** Customers, newest first (search by name / email / phone; filter by status). */
  @Get('users')
  @ApiOkResponse({ type: AdminUserListDto })
  listUsers(@Query() query: ListUsersQueryDto): Promise<AdminUserListDto> {
    return this.admin.listUsers(query);
  }

  /** One customer: profile, cards, latest point events. */
  @Get('users/:id')
  @ApiOkResponse({ type: AdminUserDetailDto })
  @ApiNotFoundResponse({ description: 'user_not_found' })
  getUser(@Param('id', ParseUuidPipe) id: string): Promise<AdminUserDetailDto> {
    return this.admin.getUser(id);
  }

  /** Block or unblock a customer. */
  @Patch('users/:id')
  @ApiOkResponse({ type: AdminUserDetailDto })
  @ApiNotFoundResponse({ description: 'user_not_found' })
  setUserStatus(@Param('id', ParseUuidPipe) id: string, @Body() dto: UpdateUserStatusDto): Promise<AdminUserDetailDto> {
    return this.admin.setUserStatus(id, dto.status);
  }
}
