import { Injectable } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

/** Days are counted in Cairo time, like the rest of the admin overview. */
const TZ = 'Africa/Cairo';

/**
 * Which QR a collect came from. No extra column is needed: every earn row points at the QR that
 * was scanned (point_events.qr_code_id), and that QR names a vendor only when it is a shop QR
 * (qr_codes.vendor_id; NULL = the master QR from the tab bar). So history is covered too.
 */
export class QrSourcesQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 365, default: 30, description: 'Period: the last N days (today included)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}

export class QrSourceTotalsDto {
  @ApiProperty({ description: 'Collects (purchases that earned points)' }) collects: number;
  @ApiProperty({ description: 'Points given' }) points: number;
}

export class QrSourcesDayDto {
  @ApiProperty({ example: '2026-10-10' }) date: string;
  @ApiProperty({ description: 'Collects with the master QR' }) master: number;
  @ApiProperty({ description: 'Collects with a shop QR' }) shop: number;
}

export class QrSourcesVendorDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) logoUrl: string | null;
  @ApiProperty() master: number;
  @ApiProperty() shop: number;
}

export class QrSourcesResponseDto {
  @ApiProperty() days: number;
  @ApiProperty({ type: QrSourceTotalsDto, description: 'Master QR (works at any shop)' }) master: QrSourceTotalsDto;
  @ApiProperty({ type: QrSourceTotalsDto, description: 'Shop QR (made on a shop page, works only there)' }) shop: QrSourceTotalsDto;
  @ApiProperty({ type: [QrSourcesDayDto], description: 'Every day of the period, oldest first' }) daily: QrSourcesDayDto[];
  @ApiProperty({ type: [QrSourcesVendorDto], description: 'Shops with collects in the period, busiest first' }) vendors: QrSourcesVendorDto[];
}

@Injectable()
export class QrStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Collects in the last `days` days, split by master QR vs shop QR. */
  async qrSources(days = 30): Promise<QrSourcesResponseDto> {
    const since = days - 1; // "last 7 days" = today and the 6 days before

    const totals = await this.prisma.$queryRaw<{ master: boolean; collects: bigint; points: bigint | null }[]>`
      SELECT (q.vendor_id IS NULL) AS master, count(*) AS collects, sum(e.delta) AS points
      FROM point_events e JOIN qr_codes q ON q.id = e.qr_code_id
      WHERE e.type = 'earn'
        AND (e.created_at AT TIME ZONE ${TZ})::date >= (now() AT TIME ZONE ${TZ})::date - ${since}::int
      GROUP BY 1`;

    const daily = await this.prisma.$queryRaw<{ day: string; master: bigint; shop: bigint }[]>`
      WITH d AS (
        SELECT generate_series((now() AT TIME ZONE ${TZ})::date - ${since}::int, (now() AT TIME ZONE ${TZ})::date, interval '1 day')::date AS day
      )
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
             count(e.id) FILTER (WHERE q.vendor_id IS NULL)     AS master,
             count(e.id) FILTER (WHERE q.vendor_id IS NOT NULL) AS shop
      FROM d
      LEFT JOIN point_events e ON e.type = 'earn' AND (e.created_at AT TIME ZONE ${TZ})::date = d.day
      LEFT JOIN qr_codes q ON q.id = e.qr_code_id
      GROUP BY d.day ORDER BY d.day`;

    const vendors = await this.prisma.$queryRaw<{ id: string; name: string; logo_url: string | null; master: bigint; shop: bigint }[]>`
      SELECT v.id, v.name, v.logo_url,
             count(*) FILTER (WHERE q.vendor_id IS NULL)     AS master,
             count(*) FILTER (WHERE q.vendor_id IS NOT NULL) AS shop
      FROM point_events e
      JOIN qr_codes q ON q.id = e.qr_code_id
      JOIN vendors v ON v.id = e.vendor_id
      WHERE e.type = 'earn'
        AND (e.created_at AT TIME ZONE ${TZ})::date >= (now() AT TIME ZONE ${TZ})::date - ${since}::int
      GROUP BY v.id, v.name, v.logo_url
      ORDER BY count(*) DESC, v.name
      LIMIT 50`;

    const n = (x: bigint | null | undefined) => Number(x ?? 0);
    const pick = (master: boolean) => {
      const row = totals.find((t) => t.master === master);
      return { collects: n(row?.collects), points: n(row?.points) };
    };
    return {
      days,
      master: pick(true),
      shop: pick(false),
      daily: daily.map((d) => ({ date: d.day, master: n(d.master), shop: n(d.shop) })),
      vendors: vendors.map((v) => ({ id: v.id, name: v.name, logoUrl: v.logo_url, master: n(v.master), shop: n(v.shop) })),
    };
  }
}
