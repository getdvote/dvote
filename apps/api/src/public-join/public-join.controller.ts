import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiServiceUnavailableResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { LIMITS, UserLimit } from '../rate-limit/rate-limit';
import { JoinResultDto, JoinVendorDto, PublicCardDto, PublicVendorDto } from './dto/public-join.dto';
import { PublicJoinService } from './public-join.service';
import { GoogleWalletService } from '../wallet/google-wallet.service';

/**
 * The public web site (dvote.app): a merchant's venue page and join form, and the card page.
 * No sign-in anywhere (decided 2026-10-17: no email code either); the customer is the email +
 * mobile number typed on the form.
 */
@ApiTags('public: join + card')
@Controller('public')
export class PublicJoinController {
  constructor(
    private readonly join: PublicJoinService,
    private readonly google: GoogleWalletService,
  ) {}

  /** dvote.app/<slug>: the merchant's logo, colours, rule, rewards and branches. */
  @Get('vendors/:slug')
  @ApiOkResponse({ type: PublicVendorDto })
  @ApiNotFoundResponse({ description: 'vendor_not_found (unknown or suspended)' })
  vendor(@Param('slug') slug: string): Promise<PublicVendorDto> {
    return this.join.vendor(slug.toLowerCase());
  }

  /**
   * Join the merchant, or get the card back (same email + same mobile = the same card).
   * Rate limited per IP (no sign-in): LIMITS.join a minute.
   */
  @Post('vendors/:slug/join')
  @HttpCode(200)
  @UserLimit(LIMITS.join)
  @ApiOkResponse({ type: JoinResultDto })
  @ApiBadRequestResponse({ description: 'invalid_phone | name_required | age_required | invalid_branch | validation (email, source)' })
  @ApiConflictResponse({ description: 'details_mismatch (the email is known with another mobile number)' })
  @ApiForbiddenResponse({ description: 'user_blocked' })
  @ApiNotFoundResponse({ description: 'vendor_not_found' })
  @ApiTooManyRequestsResponse({ description: 'rate_limited' })
  joinVendor(@Param('slug') slug: string, @Body() dto: JoinVendorDto): Promise<JoinResultDto> {
    return this.join.join(slug.toLowerCase(), dto);
  }

  /** dvote.app/c/<publicId>: the card page (balance, cardholder, short code). */
  @Get('cards/:publicId')
  @ApiOkResponse({ type: PublicCardDto })
  @ApiNotFoundResponse({ description: 'card_not_found' })
  card(@Param('publicId') publicId: string): Promise<PublicCardDto> {
    return this.join.card(publicId);
  }

  /**
   * Is the card already in a wallet? Google: the pass exists at Google (the customer saved it).
   * Apple: a device registered the pass (PassKit web service, when Apple Wallet is built).
   */
  @Get('cards/:publicId/wallet-status')
  @ApiOkResponse({ schema: { properties: { google: { type: 'boolean' }, apple: { type: 'boolean' } } } })
  @ApiNotFoundResponse({ description: 'card_not_found' })
  walletStatus(@Param('publicId') publicId: string): Promise<{ google: boolean; apple: boolean }> {
    return this.join.walletStatus(publicId);
  }

  /** "Add to Google Wallet": a signed save link for this card (open it on the phone). */
  @Get('cards/:publicId/google-wallet')
  @ApiOkResponse({ schema: { properties: { saveUrl: { type: 'string' } } } })
  @ApiNotFoundResponse({ description: 'card_not_found' })
  @ApiServiceUnavailableResponse({ description: 'wallet_not_configured' })
  async googleWallet(@Param('publicId') publicId: string): Promise<{ saveUrl: string }> {
    return { saveUrl: await this.google.saveUrl(publicId) };
  }
}
