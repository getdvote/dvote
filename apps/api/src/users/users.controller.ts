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
import { UserResponseDto } from './dto/user-response.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('app: users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'missing_token | invalid_token | token_expired',
})
@ApiForbiddenResponse({ description: 'provider_not_allowed | user_blocked' })
@UseGuards(CustomerAuthGuard)
@Controller('app/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** The signed-in customer. The first call after sign-up creates the profile. */
  @Get('me')
  @ApiOkResponse({ type: UserResponseDto })
  get(@CurrentUser() user: users): UserResponseDto {
    return UserResponseDto.from(user);
  }

  @Patch('me')
  @ApiOkResponse({ type: UserResponseDto })
  async update(
    @CurrentUser() user: users,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return UserResponseDto.from(await this.users.updateProfile(user.id, dto));
  }
}
