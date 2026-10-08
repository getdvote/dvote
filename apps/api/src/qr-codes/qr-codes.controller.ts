import { ParseUuidPipe } from '../common/uuid';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { users } from '../generated/prisma/client.js';
import { CurrentUser } from '../auth/current-user.decorator';
import { CustomerAuthGuard } from '../auth/customer-auth.guard';
import { CreateQrCodeDto } from './dto/create-qr-code.dto';
import {
  CreateQrCodeResponseDto,
  QrCodeStatusResponseDto,
} from './dto/qr-code-response.dto';
import { QrCodesService } from './qr-codes.service';

@ApiTags('app: qr codes')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'missing_token | invalid_token | token_expired',
})
@ApiForbiddenResponse({ description: 'provider_not_allowed | user_blocked' })
@UseGuards(CustomerAuthGuard)
@Controller('app/qr-codes')
export class QrCodesController {
  constructor(private readonly qrCodes: QrCodesService) {}

  /** Get a one-time collect QR (valid 5 minutes). Master QR, or vendor QR with vendorId. */
  @Post()
  @ApiCreatedResponse({ type: CreateQrCodeResponseDto })
  @ApiNotFoundResponse({ description: 'vendor_not_found' })
  create(
    @CurrentUser() user: users,
    @Body() dto: CreateQrCodeDto,
  ): Promise<CreateQrCodeResponseDto> {
    return this.qrCodes.create(user.id, dto);
  }

  /** Poll every ~2 s while the QR is shown: status, and the result once used. */
  @Get(':id')
  @ApiOkResponse({ type: QrCodeStatusResponseDto })
  @ApiNotFoundResponse({ description: 'qr_not_found' })
  status(
    @CurrentUser() user: users,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<QrCodeStatusResponseDto> {
    return this.qrCodes.status(user.id, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOkResponse({ type: QrCodeStatusResponseDto })
  @ApiNotFoundResponse({ description: 'qr_not_found' })
  cancel(
    @CurrentUser() user: users,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<QrCodeStatusResponseDto> {
    return this.qrCodes.cancel(user.id, id);
  }
}
