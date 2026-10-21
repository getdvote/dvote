import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse } from '@nestjs/swagger';
import { AdminApi } from '../auth/admin-api.decorator';
import { ParseUuidPipe } from '../common/uuid';
import { CreatePointRuleDto, PointRuleResponseDto } from './dto/point-rule.dto';
import { PointRulesService } from './point-rules.service';

@AdminApi('admin: point rules')
@Controller('admin/vendors/:vendorId/point-rules')
export class AdminPointRulesController {
  constructor(private readonly rules: PointRulesService) {}

  /** Every version of the vendor's rule, newest first (the active one has isActive). */
  @Get()
  @ApiOkResponse({ type: [PointRuleResponseDto] })
  @ApiNotFoundResponse({ description: 'vendor_not_found' })
  async list(@Param('vendorId', ParseUuidPipe) vendorId: string): Promise<PointRuleResponseDto[]> {
    return (await this.rules.list(vendorId)).map((r) => PointRuleResponseDto.from(r));
  }

  /** Publish a new rule (new version, active from now on; the previous one is retired). */
  @Post()
  @ApiCreatedResponse({ type: PointRuleResponseDto })
  @ApiNotFoundResponse({ description: 'vendor_not_found' })
  async publish(
    @Param('vendorId', ParseUuidPipe) vendorId: string,
    @Body() dto: CreatePointRuleDto,
  ): Promise<PointRuleResponseDto> {
    return PointRuleResponseDto.from(await this.rules.publish(vendorId, dto));
  }

  /** Stop earning at this vendor until a new rule is published. */
  @Delete('active')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'vendor_not_found' })
  async deactivate(@Param('vendorId', ParseUuidPipe) vendorId: string): Promise<void> {
    await this.rules.deactivate(vendorId);
  }
}
