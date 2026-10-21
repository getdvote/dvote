import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsUuid } from '../../common/uuid';

export class ListCardEventsQueryDto {
  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** Next page: the id of the last event already shown; returns the older ones after it. */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUuid()
  before?: string;
}
