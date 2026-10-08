import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { users } from '../generated/prisma/client.js';
import { CurrentUser } from '../auth/current-user.decorator';
import { CustomerAuthGuard } from '../auth/customer-auth.guard';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackService } from './feedback.service';

@ApiTags('app: feedback')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'missing_token | invalid_token | token_expired',
})
@ApiForbiddenResponse({ description: 'provider_not_allowed | user_blocked' })
@UseGuards(CustomerAuthGuard)
@Controller('app/feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  /** Adds a row to the feedback Google Sheet: time, user id, category, message. */
  @Post()
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Feedback received' })
  @ApiServiceUnavailableResponse({
    description: 'feedback_not_configured | feedback_unavailable',
  })
  async create(
    @CurrentUser() user: users,
    @Body() dto: CreateFeedbackDto,
  ): Promise<void> {
    await this.feedback.send(user.id, dto);
  }
}
