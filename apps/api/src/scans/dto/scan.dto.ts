import { IsUuid } from '../../common/uuid';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class PreviewScanDto {
  @ApiProperty({
    example: 'dvote:q1:Zx3kq0T7bQ8m2Lr9vPa1Yw',
    description: 'The text read from the QR',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  code: string;
}

export class CollectScanDto extends PreviewScanDto {
  @ApiProperty({
    example: 95.5,
    description: 'Receipt total in the vendor currency, max 2 decimals',
  })
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0.01)
  @Max(1_000_000)
  amount: number;

  @ApiPropertyOptional({
    maxLength: 64,
    example: 'R-000123',
    description: 'Receipt number; a receipt earns points once per branch',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  receiptRef?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Only for vendor admins (who have no branch): the branch where the sale happened',
  })
  @IsOptional()
  @IsUuid()
  branchId?: string;

  @ApiProperty({
    example: '6f1c2a3e-1b2c-4d5e-8f90-123456789abc',
    description:
      'A new random value per submit (e.g. a UUID). Retrying with the same key returns the first result instead of adding points twice.',
  })
  @IsString()
  @Length(8, 100)
  @Matches(/^[A-Za-z0-9_.:-]+$/)
  idempotencyKey: string;
}
