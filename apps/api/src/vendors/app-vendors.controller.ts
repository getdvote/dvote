import { ParseUuidPipe } from '../common/uuid';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { users } from '../generated/prisma/client.js';
import { CurrentUser } from '../auth/current-user.decorator';
import { CustomerAuthGuard } from '../auth/customer-auth.guard';
import { VendorPageResponseDto } from './dto/vendor-page-response.dto';
import { VendorPageService } from './vendor-page.service';

@ApiTags('app: vendors')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'missing_token | invalid_token | token_expired',
})
@ApiForbiddenResponse({ description: 'provider_not_allowed | user_blocked' })
@UseGuards(CustomerAuthGuard)
@Controller('app/vendors')
export class AppVendorsController {
  constructor(private readonly page: VendorPageService) {}

  /** Shop page: point rule, rewards, menu pages, branches (with photos) and my card there. */
  @Get(':id')
  @ApiOkResponse({ type: VendorPageResponseDto })
  @ApiNotFoundResponse({ description: 'vendor_not_found (unknown or suspended)' })
  get(
    @CurrentUser() user: users,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<VendorPageResponseDto> {
    return this.page.get(id, user.id);
  }
}
