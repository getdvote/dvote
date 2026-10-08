import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Put,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
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
import { ApiImageUpload } from '../storage/api-image-upload.decorator';
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
  get(@CurrentUser() user: users): Promise<UserResponseDto> {
    return this.users.present(user);
  }

  @Patch('me')
  @ApiOkResponse({ type: UserResponseDto })
  async update(
    @CurrentUser() user: users,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.users.present(await this.users.updateProfile(user.id, dto));
  }

  /** Upload or replace my profile photo (the previous uploaded photo is deleted). */
  @Put('me/avatar')
  @ApiImageUpload()
  @ApiOkResponse({ type: UserResponseDto })
  async setAvatar(
    @CurrentUser() user: users,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UserResponseDto> {
    return this.users.present(await this.users.setAvatar(user, file.buffer));
  }

  /** Remove my profile photo: the file is deleted from storage. */
  @Delete('me/avatar')
  @ApiOkResponse({ type: UserResponseDto })
  async removeAvatar(@CurrentUser() user: users): Promise<UserResponseDto> {
    return this.users.present(await this.users.removeAvatar(user));
  }
}
