import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TableStatDto {
  @ApiProperty({ example: 'point_events' }) name: string;
  @ApiProperty({ description: 'Approximate live rows' }) rows: number;
  @ApiProperty({ description: 'Table + indexes, bytes' }) sizeBytes: number;
}

export class BucketStatDto {
  @ApiProperty({ example: 'vendors' }) bucket: string;
  @ApiProperty() files: number;
  @ApiProperty() sizeBytes: number;
}

/** The database server (Supabase metrics). Null fields = not reported. */
export class DbServerDto {
  @ApiProperty({ type: Number, nullable: true }) memoryTotalBytes: number | null;
  @ApiProperty({ type: Number, nullable: true }) memoryAvailableBytes: number | null;
  @ApiProperty({ type: Number, nullable: true, description: 'Data disk' }) diskTotalBytes: number | null;
  @ApiProperty({ type: Number, nullable: true }) diskAvailableBytes: number | null;
  @ApiProperty({ type: Number, nullable: true, description: 'Average runnable processes, 1 min' }) load1: number | null;
  @ApiProperty({ type: Number, nullable: true }) load5: number | null;
  @ApiProperty({ type: Number, nullable: true }) load15: number | null;
  @ApiProperty({ type: Number, nullable: true }) cpus: number | null;
}

export class DatabaseStatsDto {
  @ApiProperty({ description: 'Whole database, bytes' }) sizeBytes: number;
  @ApiProperty({ example: 'PostgreSQL 17.6' }) version: string;
  @ApiProperty({ description: 'Open connections right now' }) connections: number;
  @ApiProperty() maxConnections: number;
  @ApiProperty({ type: Number, nullable: true, description: 'Reads served from memory, %' }) cacheHitPercent: number | null;
  @ApiProperty({ description: 'Sign-in accounts (customers + staff + admins); -1 = not readable' }) authUsers: number;
  @ApiProperty({ type: [TableStatDto] }) tables: TableStatDto[];
  @ApiProperty({ type: [BucketStatDto] }) storage: BucketStatDto[];
  @ApiProperty({ type: DbServerDto, nullable: true, description: 'null = server metrics unavailable (not Supabase, or no secret key)' })
  server: DbServerDto | null;
  @ApiProperty() checkedAt: string;
}

export class StatusCheckDto {
  @ApiProperty({ example: 'Database (PostgreSQL)' }) name: string;
  @ApiProperty({ enum: ['api', 'database', 'auth', 'storage', 'website'] }) kind: 'api' | 'database' | 'auth' | 'storage' | 'website';
  @ApiProperty() up: boolean;
  @ApiProperty({ description: 'How long the check took, ms' }) latencyMs: number;
  @ApiProperty({ example: 'HTTP 200' }) detail: string;
  @ApiPropertyOptional() url?: string;
}

export class SystemStatusDto {
  @ApiProperty({ type: [StatusCheckDto] }) checks: StatusCheckDto[];
  @ApiProperty() checkedAt: string;
}
