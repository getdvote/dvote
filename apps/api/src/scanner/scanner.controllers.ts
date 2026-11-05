import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffRoles, type StaffContext } from '../auth/staff-auth.guard';
import { VendorApi } from '../auth/vendor-api.decorator';
import { ParseUuidPipe } from '../common/uuid';
import { IpLimit, LIMITS } from '../rate-limit/rate-limit';
import { ClaimPairingDto, CreatePairingDto, PairingClaimedDto, PairingCreatedDto, ScannerPairingViewDto } from './dto/scanner.dto';
import { ScannerService } from './scanner.service';

/** The Scan page's Pair a phone: everyone who can scan can pair. Viewers can't. */
@VendorApi('vendor: scanner pairings')
@StaffRoles('vendor_admin', 'branch_manager', 'staff')
@Controller('vendor/scanner-pairings')
export class VendorScannerPairingsController {
  constructor(private readonly scanner: ScannerService) {}

  @Post()
  @ApiCreatedResponse({ type: PairingCreatedDto })
  @ApiBadRequestResponse({ description: 'invalid_branch' })
  create(@CurrentStaff() ctx: StaffContext, @Body() dto: CreatePairingDto): Promise<PairingCreatedDto> {
    return this.scanner.create(ctx, dto.branchId);
  }

  @Get()
  @ApiOkResponse({ type: [ScannerPairingViewDto] })
  list(@CurrentStaff() ctx: StaffContext): Promise<ScannerPairingViewDto[]> {
    return this.scanner.list(ctx);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'pairing_not_found' })
  disconnect(@CurrentStaff() ctx: StaffContext, @Param('id', ParseUuidPipe) id: string): Promise<void> {
    return this.scanner.disconnect(ctx, id);
  }
}

/** The phone trades the QR's secret and the 6 digits for a session. No sign-in. */
@ApiTags('public: scanner pairing')
@Controller('public/scanner-pairings')
export class PublicScannerPairingsController {
  constructor(private readonly scanner: ScannerService) {}

  @Post('claim')
  @HttpCode(200)
  @IpLimit(LIMITS.pairClaim)
  @ApiOkResponse({ type: PairingClaimedDto })
  @ApiBadRequestResponse({ description: 'pairing_invalid' })
  claim(@Body() dto: ClaimPairingDto): Promise<PairingClaimedDto> {
    return this.scanner.claim(dto.secret, dto.code, dto.deviceLabel);
  }
}
