import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse } from '@nestjs/swagger';
import { AdminApi } from '../auth/admin-api.decorator';
import { CurrentAdmin } from '../auth/current-admin.decorator';
import type { AdminContext } from '../auth/platform-admin.guard';
import { ParseUuidPipe } from '../common/uuid';
import { AdminService } from './admin.service';
import { AdjustCardDto, AdjustResultDto, PointAdjustService, ReversePointEventDto } from './point-adjust';
import { QrSourcesQueryDto, QrSourcesResponseDto, QrStatsService } from './qr-stats';
import {
  AdminMeResponseDto,
  AdminUserDetailDto,
  AdminUserEventsPageDto,
  ListUserEventsQueryDto,
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
    private readonly points: PointAdjustService,
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

  /** One customer's point history, a page at a time (newest first). */
  @Get('users/:id/events')
  @ApiOkResponse({ type: AdminUserEventsPageDto })
  @ApiNotFoundResponse({ description: 'user_not_found' })
  userEvents(@Param('id', ParseUuidPipe) id: string, @Query() q: ListUserEventsQueryDto): Promise<AdminUserEventsPageDto> {
    return this.admin.listUserEvents(id, q.page ?? 1, q.pageSize ?? 10);
  }

  /** Block or unblock a customer. */
  @Patch('users/:id')
  @ApiOkResponse({ type: AdminUserDetailDto })
  @ApiNotFoundResponse({ description: 'user_not_found' })
  setUserStatus(@Param('id', ParseUuidPipe) id: string, @Body() dto: UpdateUserStatusDto): Promise<AdminUserDetailDto> {
    return this.admin.setUserStatus(id, dto.status);
  }

  /** Correct a card: add or take away points with a reason (a new "adjust" ledger row). */
  @Post('cards/:id/adjust')
  @HttpCode(200)
  @ApiOkResponse({ type: AdjustResultDto })
  @ApiNotFoundResponse({ description: 'card_not_found' })
  @ApiConflictResponse({ description: 'insufficient_points (balance would go below 0), idempotency_key_reused' })
  adjustCard(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: AdjustCardDto,
  ): Promise<AdjustResultDto> {
    return this.points.adjust(ctx.adminId, id, dto);
  }

  /** Undo a mistyped collect: takes back exactly the points it gave (once per collect). */
  @Post('point-events/:id/reverse')
  @HttpCode(200)
  @ApiOkResponse({ type: AdjustResultDto })
  @ApiNotFoundResponse({ description: 'point_event_not_found' })
  @ApiConflictResponse({ description: 'not_reversible (not a collect), already_reversed, insufficient_points (already spent)' })
  reverseEvent(
    @CurrentAdmin() ctx: AdminContext,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: ReversePointEventDto,
  ): Promise<AdjustResultDto> {
    return this.points.reverse(ctx.adminId, id, dto);
  }
}
