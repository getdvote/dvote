import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { users } from '../generated/prisma/client.js';
import { CurrentUser } from '../auth/current-user.decorator';
import { CustomerAuthGuard } from '../auth/customer-auth.guard';
import { MeDto } from './dto/me.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UsersService } from './users.service';

@ApiTags('app: me')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'missing_token | invalid_token | token_expired',
})
@ApiForbiddenResponse({ description: 'provider_not_allowed | user_blocked' })
@UseGuards(CustomerAuthGuard)
@Controller('app/me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  /** The signed-in customer. The first call after sign-up creates the profile. */
  @Get()
  @ApiOkResponse({ type: MeDto })
  get(@CurrentUser() user: users): MeDto {
    return MeDto.from(user);
  }

  @Patch()
  @ApiOkResponse({ type: MeDto })
  async update(
    @CurrentUser() user: users,
    @Body() dto: UpdateMeDto,
  ): Promise<MeDto> {
    return MeDto.from(await this.users.updateProfile(user.id, dto));
  }
}
