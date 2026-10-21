import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import type { point_rules } from '../../generated/prisma/client.js';
import { fromMinor, toMinor } from '../../points/points';

/** A new rule version: replaces the active one from now on (past purchases keep their rule). */
export class CreatePointRuleDto {
  @ApiProperty({ example: 10, description: 'Spend this much (vendor currency, 2 decimals)…' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  spendAmount: number;

  @ApiProperty({ example: 1, description: '…to earn this many points (rounded down)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  pointsPerSpend: number;

  @ApiPropertyOptional({ example: 0, default: 0, description: 'Bills below this earn nothing' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  minPurchase?: number;

  @ApiPropertyOptional({ example: null, nullable: true, description: 'Cap per purchase (null = no cap)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  maxPointsPerPurchase?: number | null;
}

export class PointRuleResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 2 })
  version: number;

  @ApiProperty({ example: '10.00' })
  spendAmount: string;

  @ApiProperty({ example: 1 })
  pointsPerSpend: number;

  @ApiProperty({ example: '0.00' })
  minPurchase: string;

  @ApiProperty({ type: Number, nullable: true })
  maxPointsPerPurchase: number | null;

  @ApiProperty({ description: 'The rule used for new purchases (at most one per vendor)' })
  isActive: boolean;

  @ApiProperty()
  createdAt: string;

  static from(r: point_rules): PointRuleResponseDto {
    return {
      id: r.id,
      version: r.version,
      spendAmount: fromMinor(toMinor(r.spend_amount)),
      pointsPerSpend: r.points_per_spend,
      minPurchase: fromMinor(toMinor(r.min_purchase)),
      maxPointsPerPurchase: r.max_points_per_purchase,
      isActive: r.is_active,
      createdAt: r.created_at.toISOString(),
    };
  }
}
