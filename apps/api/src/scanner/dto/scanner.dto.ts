import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsUuid } from '../../common/uuid';

export class CreatePairingDto {
  @ApiProperty({ description: 'The branch selected on the Scan page. The phone stays on it.' })
  @IsUuid()
  branchId: string;
}

/** Lengths only: a malformed secret or code gets the same pairing_invalid as any other failure. */
export class ClaimPairingDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  secret: string;

  @ApiProperty({ description: 'The 6 digits shown on the laptop' })
  @IsString()
  @MaxLength(12)
  code: string;

  @ApiPropertyOptional({ description: 'A short name such as iPhone, for the Paired phones list' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  deviceLabel?: string;
}

export class PairingCreatedDto {
  @ApiProperty() id: string;
  @ApiProperty() secret: string;
  @ApiProperty() code: string;
  @ApiProperty() branchName: string;
  @ApiProperty() expiresAt: string;
  @ApiProperty({ description: 'For the countdown, so a wrong laptop clock cannot break it' })
  expiresInSeconds: number;
}

export class PairingClaimedDto {
  @ApiProperty() sessionToken: string;
  @ApiProperty() expiresAt: string;
}

export class ScannerPairingViewDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: ['pending', 'active', 'paused'] }) state: 'pending' | 'active' | 'paused';
  @ApiProperty({ nullable: true, type: String }) pauseReason: string | null;
  @ApiProperty({ nullable: true, type: String }) deviceLabel: string | null;
  @ApiProperty() branchId: string;
  @ApiProperty() branchName: string;
  @ApiProperty() staffName: string;
  @ApiProperty({ nullable: true, type: String }) claimedAt: string | null;
  @ApiProperty({ nullable: true, type: String }) sessionExpiresAt: string | null;
  @ApiProperty({ nullable: true, type: String }) lastUsedAt: string | null;
}
