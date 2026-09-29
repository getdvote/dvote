import { ApiProperty } from '@nestjs/swagger';

export class HealthDto {
  @ApiProperty({ example: 'ok' })
  status: 'ok';

  @ApiProperty({ example: 'up' })
  database: 'up';

  @ApiProperty({ example: '2026-09-27T10:00:00.000Z' })
  time: string;
}
