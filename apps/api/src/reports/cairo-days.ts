import { ValidateBy } from 'class-validator';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service';

const TZ = 'Africa/Cairo';

/** A `YYYY-MM-DD` query value. */
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar day as `YYYY-MM-DD` (2026-02-31 is refused, not rolled over to March). */
export const isDay = (v: unknown): v is string => {
  if (typeof v !== 'string' || !DATE_PATTERN.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`); // month 13 is an invalid Date, 31 Feb rolls over
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

/** DTO validator for day query values (400 instead of a database error on impossible dates). */
export const IsDay = () =>
  ValidateBy({
    name: 'isDay',
    validator: {
      validate: isDay,
      defaultMessage: () => '$property must be a real date, YYYY-MM-DD',
    },
  });

/**
 * A `created_at` filter for Cairo calendar days, both inclusive (either may be missing).
 * The database turns the days into instants, so daylight saving is handled there.
 */
export async function cairoDays(
  prisma: PrismaService,
  from?: string,
  to?: string,
): Promise<{ created_at?: Prisma.DateTimeFilter }> {
  if (!from && !to) return {};
  const [range] = await prisma.$queryRaw<
    { from: Date | null; to: Date | null }[]
  >`
    SELECT (${from ?? null}::date::timestamp AT TIME ZONE ${TZ})     AS "from",
           ((${to ?? null}::date + 1)::timestamp AT TIME ZONE ${TZ}) AS "to"`;
  return {
    created_at: {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lt: range.to } : {}),
    },
  };
}
