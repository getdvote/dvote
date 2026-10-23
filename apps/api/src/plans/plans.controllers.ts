import { Body, Controller, Get, Header, Put, Req } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, Max, Min } from 'class-validator';
import { AdminApi } from '../auth/admin-api.decorator';
import type { AdminRequest } from '../auth/platform-admin.guard';
import { FOUNDING } from './plans';
import { PlansService } from './plans.service';

export class FoundingSettingsDto {
  /** How many Founding Merchant spots exist (taken ones included). */
  @IsInt() @Min(0) @Max(FOUNDING.maxTotal) total: number;
  /** Show the offer on dvote.co and allow new Founding activations. */
  @IsBoolean() open: boolean;
}

/** GET /api/public/plans: prices, trial length and Founding spots left, for dvote.co/pricing. */
@ApiTags('public: plans')
@Controller('public/plans')
export class PublicPlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOkResponse({ description: '{currency, trialDays, plans[], founding {total, open, taken, left, discountPercent, months}}' })
  list() {
    return this.plans.publicPlans();
  }
}

/** GET|PUT /api/admin/settings/founding: the dvote team sets the Founding Merchants offer. */
@AdminApi('admin: plans')
@Controller('admin/settings/founding')
export class AdminFoundingController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  @ApiOkResponse({ description: '{total, open, taken, left}' })
  get() {
    return this.plans.founding();
  }

  @Put()
  @ApiOkResponse({ description: '{total, open, taken, left}' })
  set(@Req() req: AdminRequest, @Body() dto: FoundingSettingsDto) {
    return this.plans.setFounding(req.admin.adminId, dto);
  }
}
