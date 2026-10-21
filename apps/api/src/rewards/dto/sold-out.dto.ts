import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, ValidateIf } from 'class-validator';
import { IsUuid } from '../../common/uuid';

export class SetSoldOutDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Branch manager: always their branch. Vendor admin: one branch, or omit for every open branch',
  })
  @IsOptional()
  @IsUuid()
  branchId?: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '2026-10-10T21:00:00.000Z',
    description:
      'Back on sale at this time (future, at most 31 days ahead); null = until turned back on',
  })
  @ValidateIf((o: SetSoldOutDto) => o.until !== null)
  @IsISO8601({ strict: true })
  until: string | null;
}

export class ClearSoldOutQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Vendor admin: omit to put it back on sale at every branch',
  })
  @IsOptional()
  @IsUuid()
  branchId?: string;
}

export class SoldOutResponseDto {
  @ApiProperty({ format: 'uuid' }) rewardId: string;
  @ApiProperty({ format: 'uuid' }) branchId: string;
  @ApiProperty() branchName: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Back on sale at; null = until turned back on',
  })
  until: string | null;
}
