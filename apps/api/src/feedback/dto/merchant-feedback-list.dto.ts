import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsUuid } from '../../common/uuid';
import { MERCHANT_MOODS, type MerchantMood } from './create-feedback.dto';

export class ListMerchantFeedbackQueryDto {
  @ApiPropertyOptional({ enum: Object.keys(MERCHANT_MOODS) })
  @IsOptional()
  @IsIn(Object.keys(MERCHANT_MOODS))
  mood?: MerchantMood;

  @ApiPropertyOptional({ description: 'Only this merchant' })
  @IsOptional()
  @IsUuid()
  vendorId?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class MerchantFeedbackItemDto {
  @ApiProperty() id: string;
  @ApiProperty() createdAt: string;
  @ApiProperty({ enum: Object.keys(MERCHANT_MOODS), nullable: true }) mood: MerchantMood | null;
  @ApiProperty() message: string;
  @ApiProperty() vendor: { id: string; name: string; logoUrl: string | null };
  @ApiProperty() staff: { name: string; email: string; role: string };
}

export class MerchantFeedbackListDto {
  @ApiProperty({ type: [MerchantFeedbackItemDto] }) items: MerchantFeedbackItemDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  /** Counts per mood (ignores the mood filter, keeps the merchant filter). */
  @ApiProperty() moods: { love: number; okay: number; unhappy: number; none: number };
}
