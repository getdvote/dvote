import { createHash, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { SUPABASE_JWKS } from './../src/auth/supabase-jwt.verifier';
import type { staff_role } from './../src/generated/prisma/client.js';
import { PrismaService } from './../src/prisma/prisma.service';
import { createTestSigner, type TestSigner } from './helpers/test-auth';

const run = randomUUID().slice(0, 8);
const ids = {
  vendor: randomUUID(),
  other: randomUUID(),
  a1: randomUUID(),
  a2: randomUUID(),
  b1: randomUUID(),
  mona: randomUUID(),
  omar: randomUUID(),
  cardMona: randomUUID(),
  cardOmar: randomUUID(),
  cardOther: randomUUID(),
};

describe('Vendor insights: GET /api/vendor/insights (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  const tokens: Record<string, string> = {};
  const staffIds: Record<string, string> = {};
  const rules: Record<string, string> = {};
  let reward = '';

  const get = (who: string, query: string) =>
    request(app.getHttpServer())
      .get(`/api/vendor/insights${query}`)
      .set('Authorization', `Bearer ${tokens[who]}`);

  async function seedStaff(
    key: string,
    vendorId: string,
    branchId: string | null,
    role: staff_role,
  ) {
    const authId = randomUUID();
    const s = await prisma.staff_users.create({
      data: {
        vendor_id: vendorId,
        branch_id: branchId,
        name: key,
        email: `${key}-${run}@test.dvote`,
        role,
        auth_user_id: authId,
      },
    });
    staffIds[key] = s.id;
    tokens[key] = await signer.sign(authId);
  }

  /** A ledger row (and the used QR the DB requires), at noon UTC = afternoon in Cairo. */
  async function seed(
    vendorId: string,
    cardId: string,
    userId: string,
    branchId: string,
    staff: string,
    day: string,
    e: { amount?: number; redeem?: number },
  ) {
    const at = new Date(`${day}T12:00:00Z`);
    const qr = await prisma.qr_codes.create({
      data: {
        user_id: userId,
        purpose: e.redeem ? 'redeem' : 'collect',
        vendor_id: e.redeem ? vendorId : null,
        reward_id: e.redeem ? reward : null,
        token_hash: createHash('sha256').update(randomUUID()).digest('hex'),
        status: 'used',
        used_at: at,
        used_by_staff_id: staffIds[staff],
        used_branch_id: branchId,
      },
    });
    const common = {
      card_id: cardId,
      vendor_id: vendorId,
      branch_id: branchId,
      staff_id: staffIds[staff],
      qr_code_id: qr.id,
      idempotency_key: randomUUID(),
      created_at: at,
    };
    if (e.redeem) {
      const ev = await prisma.point_events.create({
        data: {
          ...common,
          type: 'redeem',
          delta: -e.redeem,
          reward_id: reward,
        },
      });
      await prisma.redemptions.create({
        data: {
          card_id: cardId,
          vendor_id: vendorId,
          reward_id: reward,
          branch_id: branchId,
          staff_id: staffIds[staff],
          point_event_id: ev.id,
          reward_name: 'Coffee',
          points_cost: e.redeem,
          created_at: at,
        },
      });
    } else {
      await prisma.point_events.create({
        data: {
          ...common,
          type: 'earn',
          delta: Math.floor(e.amount! / 10),
          purchase_amount: e.amount!,
          rule_id: rules[vendorId],
        },
      });
    }
  }

  beforeAll(async () => {
    signer = await createTestSigner();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SUPABASE_JWKS)
      .useValue(signer.jwks)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.vendors.createMany({
      data: [
        { id: ids.vendor, name: `Insights ${run}` },
        { id: ids.other, name: `Other ${run}` },
      ],
    });
    await prisma.branches.createMany({
      data: [
        { id: ids.a1, vendor_id: ids.vendor, name: 'A1' },
        { id: ids.a2, vendor_id: ids.vendor, name: 'A2' },
        { id: ids.b1, vendor_id: ids.other, name: 'B1' },
      ],
    });
    await seedStaff('admin', ids.vendor, null, 'vendor_admin');
    await seedStaff('manager', ids.vendor, ids.a1, 'branch_manager');
    await seedStaff('cashier', ids.vendor, ids.a1, 'staff');
    await seedStaff('otherCashier', ids.other, ids.b1, 'staff');
    for (const v of [ids.vendor, ids.other]) {
      rules[v] = (
        await prisma.point_rules.create({
          data: {
            vendor_id: v,
            version: 1,
            spend_amount: 10,
            points_per_spend: 1,
          },
        })
      ).id;
    }
    reward = (
      await prisma.rewards.create({
        data: { vendor_id: ids.vendor, name: 'Coffee', points_cost: 10 },
      })
    ).id;
    await prisma.users.createMany({
      data: [
        {
          id: ids.mona,
          name: 'Mona',
          email: `mona-${run}@test.dvote`,
          auth_user_id: randomUUID(),
        },
        {
          id: ids.omar,
          name: 'Omar',
          email: `omar-${run}@test.dvote`,
          auth_user_id: randomUUID(),
        },
      ],
    });
    await prisma.cards.createMany({
      data: [
        {
          id: ids.cardMona,
          user_id: ids.mona,
          vendor_id: ids.vendor,
          balance: 25,
          lifetime_points: 35,
        },
        {
          id: ids.cardOmar,
          user_id: ids.omar,
          vendor_id: ids.vendor,
          balance: 30,
          lifetime_points: 30,
        },
        {
          id: ids.cardOther,
          user_id: ids.mona,
          vendor_id: ids.other,
          balance: 99,
          lifetime_points: 99,
        },
      ],
    });

    // Previous period (1-3 Oct): Mona's first ever visit.
    await seed(
      ids.vendor,
      ids.cardMona,
      ids.mona,
      ids.a1,
      'cashier',
      '2026-10-01',
      { amount: 50 },
    );
    // This period (4-6 Oct): Mona twice at A1 (returning), Omar once at A2 (new), one reward.
    await seed(
      ids.vendor,
      ids.cardMona,
      ids.mona,
      ids.a1,
      'cashier',
      '2026-10-05',
      { amount: 100 },
    );
    await seed(
      ids.vendor,
      ids.cardMona,
      ids.mona,
      ids.a1,
      'cashier',
      '2026-10-06',
      { amount: 200 },
    );
    await seed(
      ids.vendor,
      ids.cardOmar,
      ids.omar,
      ids.a2,
      'cashier',
      '2026-10-06',
      { amount: 300 },
    );
    await seed(
      ids.vendor,
      ids.cardMona,
      ids.mona,
      ids.a1,
      'cashier',
      '2026-10-06',
      { redeem: 10 },
    );
    // Another vendor's visit never counts.
    await seed(
      ids.other,
      ids.cardOther,
      ids.mona,
      ids.b1,
      'otherCashier',
      '2026-10-06',
      { amount: 990 },
    );
  });

  afterAll(async () => {
    const v = [ids.vendor, ids.other];
    await prisma.$transaction(async (tx) => {
      // point_events is append-only (trigger): bypass triggers for test cleanup only.
      await tx.$executeRawUnsafe(
        'SET LOCAL session_replication_role = replica',
      );
      await tx.redemptions.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.point_events.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.qr_codes.deleteMany({
        where: { user_id: { in: [ids.mona, ids.omar] } },
      });
      await tx.cards.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.users.deleteMany({
        where: { id: { in: [ids.mona, ids.omar] } },
      });
      await tx.rewards.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.point_rules.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.staff_users.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.branches.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.vendors.deleteMany({ where: { id: { in: v } } });
    });
    await app.close();
  });

  it('vendor admin: KPIs, the previous period of the same length, days, branches', async () => {
    const r = (await get('admin', '?from=2026-10-04&to=2026-10-06').expect(200))
      .body;
    expect(r.range).toEqual({ from: '2026-10-04', to: '2026-10-06' });
    expect(r.previousRange).toEqual({ from: '2026-10-01', to: '2026-10-03' });
    expect(r.current).toEqual({
      sales: '600.00',
      visits: 3,
      avgBill: '200.00',
      customers: 2,
      newCustomers: 1,
      returningCustomers: 1,
      repeatRate: 0.5,
      visitsPerCustomer: 1.5,
      redeemingCustomers: 1,
      rewardsRedeemed: 1,
      pointsGiven: 60,
      pointsRedeemed: 10,
    });
    expect(r.previous).toMatchObject({
      sales: '50.00',
      visits: 1,
      customers: 1,
      newCustomers: 1,
      repeatRate: 0,
    });
    expect(r.days).toEqual([
      {
        date: '2026-10-04',
        sales: '0.00',
        visits: 0,
        previousSales: '50.00',
        previousVisits: 1,
      },
      {
        date: '2026-10-05',
        sales: '100.00',
        visits: 1,
        previousSales: '0.00',
        previousVisits: 0,
      },
      {
        date: '2026-10-06',
        sales: '500.00',
        visits: 2,
        previousSales: '0.00',
        previousVisits: 0,
      },
    ]);
    expect(
      r.branches.map((b: { name: string; sales: string; visits: number }) => [
        b.name,
        b.sales,
        b.visits,
      ]),
    ).toEqual([
      ['A1', '300.00', 2],
      ['A2', '300.00', 1],
    ]);
    expect(JSON.stringify(r)).not.toMatch(/Mona|Omar|mona-|omar-/);
  });

  it('no comparison; one branch; a branch manager is held to their branch', async () => {
    const r = (
      await get(
        'admin',
        `?from=2026-10-04&to=2026-10-06&compare=none&branchId=${ids.a2}`,
      ).expect(200)
    ).body;
    expect(r).toMatchObject({
      previousRange: null,
      previous: null,
      branches: [],
    });
    expect(r.current).toMatchObject({
      sales: '300.00',
      visits: 1,
      newCustomers: 1,
    });
    expect(r.days[2].previousSales).toBeNull();

    // A1's manager asking for A2 still gets A1: Mona's 2 visits; she's not new there (first visit 1 Oct).
    const m = (
      await get(
        'manager',
        `?from=2026-10-04&to=2026-10-06&branchId=${ids.a2}`,
      ).expect(200)
    ).body;
    expect(m.current).toMatchObject({
      sales: '300.00',
      visits: 2,
      customers: 1,
      newCustomers: 0,
      repeatRate: 1,
    });
    expect(m.branches).toEqual([]);
  });

  it('bad ranges are 400; staff are refused', async () => {
    expect(
      (await get('admin', '?from=2026-10-06&to=2026-10-04').expect(400)).body
        .code,
    ).toBe('range_invalid');
    // An impossible date is refused by validation, not left to fail in the database.
    await get('admin', '?from=2026-02-31&to=2026-03-02').expect(400);
    expect(
      (await get('admin', '?from=2025-01-01&to=2026-10-06').expect(400)).body
        .code,
    ).toBe('range_too_long');
    await get('admin', '?from=2026-10-04').expect(400);
    await get('admin', '?from=2026-10-04&to=2026-10-06&compare=year').expect(
      400,
    );
    await get('cashier', '?from=2026-10-04&to=2026-10-06').expect(403);
  });
});
