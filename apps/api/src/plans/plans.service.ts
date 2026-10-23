import { ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { TRIAL } from '../trial/trial-rules';
import { FOUNDING, PLAN_PRICES } from './plans';

export interface FoundingSettings {
  total: number;
  open: boolean;
}

export interface FoundingStatus extends FoundingSettings {
  taken: number;
  left: number;
}

type Db = PrismaService | Prisma.TransactionClient;

/** The public price list and the Founding Merchants counter (set by the dvote team). */
@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /api/public/plans */
  async publicPlans() {
    return {
      currency: 'EGP',
      trialDays: TRIAL.trialDays,
      plans: PLAN_PRICES,
      founding: { ...(await this.founding()), discountPercent: FOUNDING.discountPercent, months: FOUNDING.months },
    };
  }

  async founding(db: Db = this.prisma): Promise<FoundingStatus> {
    const [row, taken] = await Promise.all([
      db.platform_settings.findUnique({ where: { key: 'founding' } }),
      db.vendors.count({ where: { founding: true } }),
    ]);
    const s = readSettings(row?.value);
    return { ...s, taken, left: s.open ? Math.max(0, s.total - taken) : 0 };
  }

  async setFounding(adminId: string, input: FoundingSettings): Promise<FoundingStatus> {
    const value = { total: input.total, open: input.open };
    await this.prisma.platform_settings.upsert({
      where: { key: 'founding' },
      create: { key: 'founding', value, updated_by: adminId },
      update: { value, updated_by: adminId },
    });
    return this.founding();
  }

  /**
   * Inside the activation transaction: take a Founding spot, or fail with founding_full.
   * Locks the settings row so two activations can't take the last spot together.
   */
  async takeFoundingSpot(tx: Prisma.TransactionClient, vendorId: string) {
    await tx.$queryRaw`SELECT key FROM platform_settings WHERE key = 'founding' FOR UPDATE`;
    const already = await tx.vendors.count({ where: { id: vendorId, founding: true } });
    if (already) return;
    const f = await this.founding(tx);
    if (f.left <= 0) throw new ConflictException({ code: 'founding_full', message: 'No Founding Merchant spots are left.' });
  }
}

function readSettings(value: unknown): FoundingSettings {
  const v = (value ?? {}) as Partial<FoundingSettings>;
  const total = Number.isInteger(v.total) && (v.total as number) >= 0 ? (v.total as number) : FOUNDING.defaultTotal;
  return { total, open: v.open !== false };
}
