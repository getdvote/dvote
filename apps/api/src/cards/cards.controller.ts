import { ParseUuidPipe } from '../common/uuid';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
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
import { CardsService } from './cards.service';
import { CardEventResponseDto, CardResponseDto } from './dto/card-response.dto';
import { ListCardEventsQueryDto } from './dto/list-card-events-query.dto';

@ApiTags('app: cards')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'missing_token | invalid_token | token_expired',
})
@ApiForbiddenResponse({ description: 'provider_not_allowed | user_blocked' })
@UseGuards(CustomerAuthGuard)
@Controller('app/cards')
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  /** My cards: points per vendor, with progress to the next reward. */
  @Get()
  @ApiOkResponse({ type: [CardResponseDto] })
  list(@CurrentUser() user: users): Promise<CardResponseDto[]> {
    return this.cards.list(user.id);
  }

  @Get(':id/events')
  @ApiOkResponse({ type: [CardEventResponseDto] })
  @ApiNotFoundResponse({ description: 'card_not_found' })
  events(
    @CurrentUser() user: users,
    @Param('id', ParseUuidPipe) id: string,
    @Query() query: ListCardEventsQueryDto,
  ): Promise<CardEventResponseDto[]> {
    return this.cards.events(user.id, id, query.limit);
  }
}
