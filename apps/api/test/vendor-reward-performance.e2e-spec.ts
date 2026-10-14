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
  sara: randomUUID(),
  blocked: randomUUID(),
  empty: randomUUID(),
  cardMona: randomUUID(),
  cardOmar: randomUUID(),
  cardSara: randomUUID(),
  cardBlocked: randomUUID(),
  cardEmpty: randomUUID(),
  cardOther: randomUUID(),
};
const users = [ids.mona, ids.omar, ids.sara, ids.blocked, ids.empty];

describe('Reward performance: GET /api/vendor/reward-performance (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  const tokens: Record<string, string> = {};
  const staffIds: Record<string, string> = {};
  const rewards: Record<string, string> = {};

  const get = (who: string, query: string) =>
    request(app.getHttpServer())
      .get(`/api/vendor/reward-performance${query}`)
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

  /** A redemption (ledger row + used QR the DB requires), at noon UTC = afternoon in Cairo. */
  async function redeem(
    cardId: string,
    userId: string,
    branchId: string,
    reward: string,
    cost: number,
    day: string,
  ) {
    const at = new Date(`${day}T12:00:00Z`);
    const qr = await prisma.qr_codes.create({
      data: {
        user_id: userId,
        purpose: 'redeem',
        vendor_id: ids.vendor,
        reward_id: rewards[reward],
        token_hash: createHash('sha256').update(randomUUID()).digest('hex'),
        status: 'used',
        used_at: at,
        used_by_staff_id: staffIds.cashier,
        used_branch_id: branchId,
      },
    });
    const ev = await prisma.point_events.create({
      data: {
        card_id: cardId,
        vendor_id: ids.vendor,
        branch_id: branchId,
        staff_id: staffIds.cashier,
        qr_code_id: qr.id,
        idempotency_key: randomUUID(),
        created_at: at,
        type: 'redeem',
        delta: -cost,
        reward_id: rewards[reward],
      },
    });
    await prisma.redemptions.create({
      data: {
        card_id: cardId,
        vendor_id: ids.vendor,
        reward_id: rewards[reward],
        branch_id: branchId,
        staff_id: staffIds.cashier,
        point_event_id: ev.id,
        reward_name: reward,
        points_cost: cost,
        created_at: at,
      },
    });
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
        { id: ids.vendor, name: `Rewards ${run}` },
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
    await seedStaff('otherAdmin', ids.other, null, 'vendor_admin');
    // 10 EGP = 1 point here; the other merchant has no rule.
    await prisma.point_rules.create({
      data: {
        vendor_id: ids.vendor,
        version: 1,
        spend_amount: 10,
        points_per_spend: 1,
      },
    });
    for (const [name, cost, status] of [
      ['Coffee', 100, 'active'],
      ['Cake', 250, 'active'],
      ['Old', 50, 'archived'],
      ['Unused', 30, 'archived'],
    ] as const) {
      rewards[name] = (
        await prisma.rewards.create({
          data: { vendor_id: ids.vendor, name, points_cost: cost, status },
        })
      ).id;
    }
    await prisma.users.createMany({
      data: users.map((id, i) => ({
        id,
        name: `Customer ${i}`,
        email: `c${i}-${run}@test.dvote`,
        auth_user_id: randomUUID(),
        status: id === ids.blocked ? ('blocked' as const) : ('active' as const),
      })),
    });
    // Mona can afford both; Omar is close to Coffee (90 of 100); Sara can afford Coffee and is
    // close to Cake (210 of 250). The blocked customer, the empty card and the other merchant never count.
    await prisma.cards.createMany({
      data: [
        [ids.cardMona, ids.mona, ids.vendor, 300],
        [ids.cardOmar, ids.omar, ids.vendor, 90],
        [ids.cardSara, ids.sara, ids.vendor, 210],
        [ids.cardBlocked, ids.blocked, ids.vendor, 500],
        [ids.cardEmpty, ids.empty, ids.vendor, 0],
        [ids.cardOther, ids.mona, ids.other, 999],
      ].map(([id, user_id, vendor_id, balance]) => ({
        id: id as string,
        user_id: user_id as string,
        vendor_id: vendor_id as string,
        balance: balance as number,
        lifetime_points: 1000,
      })),
    });

    // Before the period: never counted.
    await redeem(ids.cardMona, ids.mona, ids.a1, 'Coffee', 100, '2026-10-01');
    // In the period (4-6 Oct).
    await redeem(ids.cardMona, ids.mona, ids.a1, 'Coffee', 100, '2026-10-05');
    await redeem(ids.cardSara, ids.sara, ids.a2, 'Coffee', 100, '2026-10-06');
    await redeem(ids.cardMona, ids.mona, ids.a1, 'Coffee', 100, '2026-10-06');
    await redeem(ids.cardOmar, ids.omar, ids.a1, 'Old', 50, '2026-10-06');
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
      await tx.qr_codes.deleteMany({ where: { user_id: { in: users } } });
      await tx.cards.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.users.deleteMany({ where: { id: { in: users } } });
      await tx.rewards.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.point_rules.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.staff_users.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.branches.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.vendors.deleteMany({ where: { id: { in: v } } });
    });
    await app.close();
  });

  const row = (r: {
    name: string;
    redemptions: number;
    customers: number;
    canAfford: number | null;
    close: number | null;
  }) => [r.name, r.redemptions, r.customers, r.canAfford, r.close];

  it('vendor admin: per reward, points held and what they are worth', async () => {
    const r = (await get('admin', '?from=2026-10-04&to=2026-10-06').expect(200))
      .body;
    expect(r.range).toEqual({ from: '2026-10-04', to: '2026-10-06' });
    expect(r.held).toEqual({
      points: 600,
      customers: 3,
      worth: '6000.00',
      rate: { spendAmount: '10.00', pointsPerSpend: 1 },
      readyToRedeem: 2,
      closeToReward: 2,
    });
    // Most given first; the archived reward shows only because it was given; Unused never shows.
    expect(r.rewards.map(row)).toEqual([
      ['Coffee', 3, 2, 2, 1],
      ['Old', 1, 1, 0, 0],
      ['Cake', 0, 0, 1, 1],
    ]);
    expect(r.rewards[0]).toMatchObject({
      status: 'active',
      pointsCost: 100,
      pointsRedeemed: 300,
    });
    expect(JSON.stringify(r)).not.toMatch(new RegExp(`Customer \\d|${run}@`));
  });

  it('a branch filters redemptions only; a branch manager gets no balances', async () => {
    const a = (
      await get(
        'admin',
        `?from=2026-10-04&to=2026-10-06&branchId=${ids.a2}`,
      ).expect(200)
    ).body;
    expect(a.held.points).toBe(600);
    expect(a.rewards.map(row)).toEqual([
      ['Coffee', 1, 1, 2, 1],
      ['Cake', 0, 0, 1, 1],
    ]);

    // A1's manager asking for A2 still gets A1.
    const m = (
      await get(
        'manager',
        `?from=2026-10-04&to=2026-10-06&branchId=${ids.a2}`,
      ).expect(200)
    ).body;
    expect(m.held).toBeNull();
    expect(m.rewards.map(row)).toEqual([
      ['Coffee', 2, 1, null, null],
      ['Old', 1, 1, null, null],
      ['Cake', 0, 0, null, null],
    ]);
  });

  it('no rule means no worth; other merchants see nothing of ours; bad input is refused', async () => {
    const o = (
      await get('otherAdmin', '?from=2026-10-04&to=2026-10-06').expect(200)
    ).body;
    expect(o.held).toEqual({
      points: 999,
      customers: 1,
      worth: null,
      rate: null,
      readyToRedeem: 0,
      closeToReward: 0,
    });
    expect(o.rewards).toEqual([]);

    await get('admin', '?from=2026-10-04').expect(400);
    await get('admin', '?from=2026-02-31&to=2026-03-02').expect(400);
    await get('cashier', '?from=2026-10-04&to=2026-10-06').expect(403);
  });
});
