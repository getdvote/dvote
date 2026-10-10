import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';

/** Days are Cairo days, like the rest of the reports. */
const TZ = 'Africa/Cairo';
const EVERY_MS = 15 * 60 * 1000;

/**
 * The risk rules (CLAUDE.md "Fraud flags"). A flag is a note for a platform admin to look at:
 * it never blocks anything by itself.
 */
export const FRAUD_RULES = {
  /** too_many_collects: more than this many collects by one customer at one shop in a day. */
  maxCollectsPerDay: 3,
  /** large_purchase: a bill this many times the branch's 30-day average bill… */
  largePurchaseFactor: 5,
  /** …once the branch has at least this many bills in those 30 days (a fair average). */
  largePurchaseMinHistory: 10,
  /** branch_spike / staff_spike: a day's points this many times the 30-day daily average… */
  spikeFactor: 3,
  /** …and at least this many points that day (a tiny branch going 2 → 7 points is no spike). */
  spikeMinPoints: 100,
} as const;

export interface FraudCheckResult {
  at: string;
  created: number;
  byType: Record<string, number>;
}

/**
 * Looks for the four risk patterns in today's and yesterday's activity (so late events still
 * count) and writes one fraud_flags row per finding. Safe to run any time and any number of
 * times: every finding has a `key` and is inserted with ON CONFLICT DO NOTHING.
 * Runs every 15 minutes inside the API (one container in v1), and on demand from the admin
 * dashboard ("Run check now").
 */
@Injectable()
export class FraudCheckService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('FraudCheck');
  private timer?: NodeJS.Timeout;
  private running: Promise<FraudCheckResult> | null = null;
  last: FraudCheckResult | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpAdapterHost,
  ) {}

  onApplicationBootstrap() {
    // Only in the running API: not in tests (they call run() themselves) nor in scripts.
    if (process.env.NODE_ENV === 'test' || !this.http?.httpAdapter) return;
    this.timer = setInterval(() => void this.run().catch((e) => this.log.warn(`check failed: ${String(e)}`)), EVERY_MS);
    this.timer.unref();
    setTimeout(() => void this.run().catch(() => undefined), 30_000).unref(); // first check soon after start
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  /** Runs the check (or joins the one already running). */
  run(): Promise<FraudCheckResult> {
    this.running ??= this.check().finally(() => (this.running = null));
    return this.running;
  }

  private async check(): Promise<FraudCheckResult> {
    const r = FRAUD_RULES;
    const counts = await Promise.all([
      // 1. too_many_collects: one customer, one shop, one day.
      this.prisma.$executeRaw`
        INSERT INTO fraud_flags (type, vendor_id, user_id, details, key)
        SELECT 'too_many_collects', e.vendor_id, c.user_id,
               jsonb_build_object('day', d.day, 'collects', count(*), 'points', sum(e.delta), 'limit', ${r.maxCollectsPerDay}::int),
               'too_many_collects:' || c.user_id || ':' || e.vendor_id || ':' || d.day
        FROM point_events e
        JOIN cards c ON c.id = e.card_id
        CROSS JOIN LATERAL (SELECT to_char((e.created_at AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS day) d
        WHERE e.type = 'earn'
          AND (e.created_at AT TIME ZONE ${TZ})::date >= (now() AT TIME ZONE ${TZ})::date - 1
        GROUP BY e.vendor_id, c.user_id, d.day
        HAVING count(*) > ${r.maxCollectsPerDay}
        ON CONFLICT (key) DO NOTHING`,

      // 2. large_purchase: one bill far above its branch's usual bill (30 days before it).
      this.prisma.$executeRaw`
        INSERT INTO fraud_flags (type, vendor_id, branch_id, user_id, staff_id, details, key)
        SELECT 'large_purchase', e.vendor_id, e.branch_id, c.user_id, e.staff_id,
               jsonb_build_object('day', to_char((e.created_at AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD'),
                                  'pointEventId', e.id, 'amount', e.purchase_amount, 'points', e.delta,
                                  'average', round(h.avg_amount, 2), 'bills30d', h.n, 'factor', ${r.largePurchaseFactor}::int),
               'large_purchase:' || e.id
        FROM point_events e
        JOIN cards c ON c.id = e.card_id
        CROSS JOIN LATERAL (
          SELECT avg(p.purchase_amount) AS avg_amount, count(*) AS n
          FROM point_events p
          WHERE p.branch_id = e.branch_id AND p.type = 'earn' AND p.id <> e.id
            AND p.created_at >= e.created_at - interval '30 days' AND p.created_at < e.created_at
        ) h
        WHERE e.type = 'earn'
          AND (e.created_at AT TIME ZONE ${TZ})::date >= (now() AT TIME ZONE ${TZ})::date - 1
          AND h.n >= ${r.largePurchaseMinHistory}
          AND e.purchase_amount > ${r.largePurchaseFactor} * h.avg_amount
        ON CONFLICT (key) DO NOTHING`,

      // 3 + 4. branch_spike / staff_spike: a day's points vs the 30 days before it.
      this.spike('branch'),
      this.spike('staff'),
    ]);
    const types = ['too_many_collects', 'large_purchase', 'branch_spike', 'staff_spike'];
    const byType = Object.fromEntries(types.map((t, i) => [t, counts[i]]));
    const result = { at: new Date().toISOString(), created: counts.reduce((a, b) => a + b, 0), byType };
    this.last = result;
    if (result.created) this.log.log(`${result.created} new fraud flag(s): ${JSON.stringify(byType)}`);
    return result;
  }

  private spike(of: 'branch' | 'staff') {
    const r = FRAUD_RULES;
    const col = Prisma.raw(of === 'branch' ? 'branch_id' : 'staff_id');
    const type = of === 'branch' ? 'branch_spike' : 'staff_spike';
    return this.prisma.$executeRaw`
      WITH days AS (
        SELECT e.vendor_id, e.${col} AS target, (e.created_at AT TIME ZONE ${TZ})::date AS day, sum(e.delta) AS points
        FROM point_events e
        WHERE e.type = 'earn' AND e.${col} IS NOT NULL
          AND (e.created_at AT TIME ZONE ${TZ})::date >= (now() AT TIME ZONE ${TZ})::date - 1
        GROUP BY 1, 2, 3
      )
      INSERT INTO fraud_flags (type, vendor_id, ${col}, details, key)
      SELECT ${type}::fraud_flag_type, d.vendor_id, d.target,
             jsonb_build_object('day', to_char(d.day, 'YYYY-MM-DD'), 'points', d.points,
                                'dailyAverage', round(h.points30 / 30.0, 1), 'factor', ${r.spikeFactor}::int),
             ${type}::text || ':' || d.target::text || ':' || to_char(d.day, 'YYYY-MM-DD')
      FROM days d
      CROSS JOIN LATERAL (
        SELECT COALESCE(sum(p.delta), 0) AS points30
        FROM point_events p
        WHERE p.${col} = d.target AND p.type = 'earn'
          AND (p.created_at AT TIME ZONE ${TZ})::date BETWEEN d.day - 30 AND d.day - 1
      ) h
      WHERE h.points30 > 0
        AND d.points >= ${r.spikeMinPoints}
        AND d.points > ${r.spikeFactor} * (h.points30 / 30.0)
      ON CONFLICT (key) DO NOTHING`;
  }
}
