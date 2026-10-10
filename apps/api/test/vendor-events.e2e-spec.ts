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
  vendorA: randomUUID(),
  vendorB: randomUUID(),
  branchA1: randomUUID(),
  branchA2: randomUUID(),
  branchB1: randomUUID(),
  user: randomUUID(),
  cardA: randomUUID(),
  cardB: randomUUID(),
};

interface Item {
  type: string;
  points: number;
  amount: string | null;
  receiptRef: string | null;
  branch: { name: string } | null;
  staff: { name: string } | null;
  reward: { name: string } | null;
  customerRef: string;
}

describe('Vendor activity log + redemptions: GET /api/vendor/events, /api/vendor/redemptions (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  const tokens: Record<string, string> = {};
  const staffIds: Record<string, string> = {};
  const rules: Record<string, string> = {};
  let rewardA = '';

  const get = (who: string, query = '') =>
    request(app.getHttpServer())
      .get(`/api/vendor/events${query}`)
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

  /** One ledger row with the used QR the DB requires (as a scan would write it). */
  async function seedEvent(e: {
    vendorId: string;
    cardId: string;
    branchId: string;
    staff: string;
    at: string;
    earn?: { points: number; amount: string; receipt?: string };
    redeem?: { cost: number; snapshotName: string; rewardId?: string };
  }) {
    const qr = await prisma.qr_codes.create({
      data: {
        user_id: ids.user,
        purpose: e.earn ? 'collect' : 'redeem',
        vendor_id: e.redeem ? e.vendorId : null,
        reward_id: e.redeem ? (e.redeem.rewardId ?? rewardA) : null,
        token_hash: createHash('sha256').update(randomUUID()).digest('hex'),
        status: 'used',
        used_at: new Date(e.at),
        used_by_staff_id: staffIds[e.staff],
        used_branch_id: e.branchId,
      },
    });
    const common = {
      card_id: e.cardId,
      vendor_id: e.vendorId,
      branch_id: e.branchId,
      staff_id: staffIds[e.staff],
      qr_code_id: qr.id,
      idempotency_key: randomUUID(),
      created_at: new Date(e.at),
    };
    if (e.earn) {
      await prisma.point_events.create({
        data: {
          ...common,
          type: 'earn',
          delta: e.earn.points,
          purchase_amount: e.earn.amount,
          receipt_ref: e.earn.receipt ?? null,
          rule_id: rules[e.vendorId],
        },
      });
    } else if (e.redeem) {
      const ev = await prisma.point_events.create({
        data: {
          ...common,
          type: 'redeem',
          delta: -e.redeem.cost,
          reward_id: e.redeem.rewardId ?? rewardA,
        },
      });
      await prisma.redemptions.create({
        data: {
          card_id: e.cardId,
          vendor_id: e.vendorId,
          reward_id: e.redeem.rewardId ?? rewardA,
          branch_id: e.branchId,
          staff_id: staffIds[e.staff],
          point_event_id: ev.id,
          reward_name: e.redeem.snapshotName,
          points_cost: e.redeem.cost,
          // same moment as its ledger row (as the redeem transaction writes them), so the
          // date filters don't depend on the day the tests run
          created_at: new Date(e.at),
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
        { id: ids.vendorA, name: `Joy ${run}` },
        { id: ids.vendorB, name: `Other ${run}` },
      ],
    });
    await prisma.branches.createMany({
      data: [
        { id: ids.branchA1, vendor_id: ids.vendorA, name: 'A1' },
        { id: ids.branchA2, vendor_id: ids.vendorA, name: 'A2' },
        { id: ids.branchB1, vendor_id: ids.vendorB, name: 'B1' },
      ],
    });
    await seedStaff('adminA', ids.vendorA, null, 'vendor_admin');
    await seedStaff('managerA1', ids.vendorA, ids.branchA1, 'branch_manager');
    await seedStaff('cashierA1', ids.vendorA, ids.branchA1, 'staff');
    await seedStaff('cashierA2', ids.vendorA, ids.branchA2, 'staff');
    await seedStaff('cashierB1', ids.vendorB, ids.branchB1, 'staff');
    await seedStaff('adminB', ids.vendorB, null, 'vendor_admin');
    for (const v of [ids.vendorA, ids.vendorB]) {
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
    rewardA = (
      await prisma.rewards.create({
        data: { vendor_id: ids.vendorA, name: 'Free coffee', points_cost: 30 },
      })
    ).id;
    await prisma.users.create({
      data: {
        id: ids.user,
        name: 'Mona',
        email: `mona-${run}@test.dvote`,
        auth_user_id: randomUUID(),
      },
    });
    await prisma.cards.createMany({
      data: [
        {
          id: ids.cardA,
          user_id: ids.user,
          vendor_id: ids.vendorA,
          balance: 4,
          lifetime_points: 34,
        },
        {
          id: ids.cardB,
          user_id: ids.user,
          vendor_id: ids.vendorB,
          balance: 5,
          lifetime_points: 5,
        },
      ],
    });

    // Cairo is UTC+3 in October: 2026-10-05 22:30Z is already 6 October in Cairo.
    await seedEvent({
      vendorId: ids.vendorA,
      cardId: ids.cardA,
      branchId: ids.branchA1,
      staff: 'cashierA1',
      at: '2026-10-05T22:30:00Z',
      earn: { points: 9, amount: '95.00', receipt: 'R-100' },
    });
    await seedEvent({
      vendorId: ids.vendorA,
      cardId: ids.cardA,
      branchId: ids.branchA2,
      staff: 'cashierA2',
      at: '2026-10-08T10:00:00Z',
      earn: { points: 25, amount: '250.50', receipt: 'X-7' },
    });
    await seedEvent({
      vendorId: ids.vendorA,
      cardId: ids.cardA,
      branchId: ids.branchA1,
      staff: 'cashierA1',
      at: '2026-10-09T10:00:00Z',
      redeem: { cost: 30, snapshotName: 'Free coffee (old name)' },
    });
    await seedEvent({
      vendorId: ids.vendorB,
      cardId: ids.cardB,
      branchId: ids.branchB1,
      staff: 'cashierB1',
      at: '2026-10-09T11:00:00Z',
      earn: { points: 5, amount: '50.00' },
    });
  });

  afterAll(async () => {
    const v = [ids.vendorA, ids.vendorB];
    await prisma.$transaction(async (tx) => {
      // point_events is append-only (trigger): bypass triggers for test cleanup only.
      await tx.$executeRawUnsafe(
        'SET LOCAL session_replication_role = replica',
      );
      await tx.redemptions.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.point_events.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.qr_codes.deleteMany({ where: { user_id: ids.user } });
      await tx.cards.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.users.deleteMany({ where: { id: ids.user } });
      await tx.rewards.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.point_rules.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.staff_users.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.branches.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.vendors.deleteMany({ where: { id: { in: v } } });
    });
    await app.close();
  });

  it('vendor admin: all my branches, newest first, never another vendor’s rows, no customer identity', async () => {
    const res = await get('adminA').expect(200);
    const items = res.body.items as Item[];
    expect(items.map((i) => [i.type, i.points, i.branch?.name])).toEqual([
      ['redeem', -30, 'A1'],
      ['earn', 25, 'A2'],
      ['earn', 9, 'A1'],
    ]);
    expect(items[0]).toMatchObject({
      amount: null,
      reward: { name: 'Free coffee (old name)' },
      staff: { name: 'cashierA1' },
    });
    expect(items[1]).toMatchObject({
      amount: '250.50',
      receiptRef: 'X-7',
      reward: null,
      staff: { name: 'cashierA2' },
    });
    expect(items[0].customerRef).toBe(ids.cardA.slice(0, 6).toUpperCase());
    expect(JSON.stringify(res.body)).not.toMatch(/Mona|mona-/);
    expect(res.body).toMatchObject({
      total: 3,
      page: 1,
      pageSize: 25,
      totals: {
        collects: 2,
        redemptions: 1,
        pointsEarned: 34,
        pointsRedeemed: 30,
        sales: '345.50',
      },
    });
  });

  it('filters: type, branch, staff, receipt, Cairo days, paging', async () => {
    expect((await get('adminA', '?type=earn').expect(200)).body.total).toBe(2);
    expect(
      (
        await get('adminA', `?branchId=${ids.branchA2}`).expect(200)
      ).body.items.map((i: Item) => i.points),
    ).toEqual([25]);
    expect(
      (await get('adminA', `?staffId=${staffIds.cashierA1}`).expect(200)).body
        .total,
    ).toBe(2);
    expect(
      (await get('adminA', '?receipt=r-1').expect(200)).body.items.map(
        (i: Item) => i.receiptRef,
      ),
    ).toEqual(['R-100']);
    // 22:30Z on 5 Oct is 6 Oct in Cairo.
    expect(
      (
        await get('adminA', '?from=2026-10-06&to=2026-10-06').expect(200)
      ).body.items.map((i: Item) => i.points),
    ).toEqual([9]);
    expect((await get('adminA', '?to=2026-10-05').expect(200)).body.total).toBe(
      0,
    );
    const page2 = (await get('adminA', '?pageSize=2&page=2').expect(200)).body;
    expect(page2.items.map((i: Item) => i.points)).toEqual([9]);
    expect(page2.totals.collects).toBe(2); // totals cover every page
    // Another vendor's branch matches nothing rather than leaking its rows.
    expect(
      (await get('adminA', `?branchId=${ids.branchB1}`).expect(200)).body.total,
    ).toBe(0);
  });

  it('branch manager: their branch only, even when asking for another', async () => {
    const own = (await get('managerA1').expect(200)).body;
    expect(own.items.map((i: Item) => i.branch?.name)).toEqual(['A1', 'A1']);
    expect(
      (
        await get('managerA1', `?branchId=${ids.branchA2}`).expect(200)
      ).body.items.map((i: Item) => i.branch?.name),
    ).toEqual(['A1', 'A1']);
  });

  it('staff role is refused; bad filters are 400', async () => {
    await get('cashierA1').expect(403);
    await get('adminA', '?type=bonus').expect(400);
    await get('adminA', '?from=6-10-2026').expect(400);
    await get('adminA', '?from=2026-02-31').expect(400); // impossible date: 400, not a database error
    await get('adminA', '?branchId=nope').expect(400);
    await get('adminA', '?pageSize=500').expect(400);
  });
  // Runs last: it adds two more redemptions, which the activity tests above don't expect.
  it('redemptions: list, totals, per-reward breakdown, filters, branch manager scope', async () => {
    const cake = await prisma.rewards.create({
      data: {
        vendor_id: ids.vendorA,
        name: 'Cheesecake',
        points_cost: 50,
        image_url: 'https://img.test/cake.webp',
      },
    });
    await prisma.cards.update({
      where: { id: ids.cardA },
      data: { balance: 0 },
    });
    await seedEvent({
      vendorId: ids.vendorA,
      cardId: ids.cardA,
      branchId: ids.branchA2,
      staff: 'cashierA2',
      at: '2026-10-09T12:00:00Z',
      redeem: { cost: 50, snapshotName: 'Cheesecake', rewardId: cake.id },
    });
    await seedEvent({
      vendorId: ids.vendorA,
      cardId: ids.cardA,
      branchId: ids.branchA2,
      staff: 'cashierA2',
      at: '2026-10-09T13:00:00Z',
      redeem: { cost: 50, snapshotName: 'Cheesecake', rewardId: cake.id },
    });
    const red = (who: string, query = '') =>
      request(app.getHttpServer())
        .get(`/api/vendor/redemptions${query}`)
        .set('Authorization', `Bearer ${tokens[who]}`);

    const all = (await red('adminA').expect(200)).body;
    expect(
      all.items.map((r: { rewardName: string; branch: { name: string } }) => [
        r.rewardName,
        r.branch.name,
      ]),
    ).toEqual([
      ['Cheesecake', 'A2'],
      ['Cheesecake', 'A2'],
      ['Free coffee (old name)', 'A1'],
    ]);
    expect(all.items[0]).toMatchObject({
      pointsCost: 50,
      imageUrl: 'https://img.test/cake.webp',
      staff: { name: 'cashierA2' },
      customerRef: ids.cardA.slice(0, 6).toUpperCase(),
    });
    expect(all.totals).toEqual({ redemptions: 3, points: 130, customers: 1 });
    // Breakdown uses the reward's current name, most given first.
    expect(
      all.byReward.map((r: { name: string; count: number; points: number }) => [
        r.name,
        r.count,
        r.points,
      ]),
    ).toEqual([
      ['Cheesecake', 2, 100],
      ['Free coffee', 1, 30],
    ]);
    expect(JSON.stringify(all)).not.toMatch(/Mona|mona-/);

    // The reward filter narrows the list but not the breakdown (used to pick a reward).
    const coffee = (await red('adminA', `?rewardId=${rewardA}`).expect(200))
      .body;
    expect(coffee.total).toBe(1);
    expect(coffee.byReward).toHaveLength(2);
    expect(
      (await red('adminA', `?branchId=${ids.branchA1}`).expect(200)).body.total,
    ).toBe(1);
    expect(
      (await red('adminA', `?staffId=${staffIds.cashierA2}`).expect(200)).body
        .total,
    ).toBe(2);
    expect(
      (await red('adminA', '?from=2026-10-10').expect(200)).body.total,
    ).toBe(0);
    expect(
      (await red('adminA', '?pageSize=1&page=3').expect(200)).body.items[0]
        .rewardName,
    ).toBe('Free coffee (old name)');

    // Branch manager: own branch only; other vendors see none of it.
    const mine = (
      await red('managerA1', `?branchId=${ids.branchA2}`).expect(200)
    ).body;
    expect(
      mine.items.map((r: { branch: { name: string } }) => r.branch.name),
    ).toEqual(['A1']);
    expect(mine.byReward.map((r: { name: string }) => r.name)).toEqual([
      'Free coffee',
    ]);
    expect((await red('adminB').expect(200)).body.total).toBe(0);
    await red('cashierA1').expect(403);
    await red('adminA', '?rewardId=nope').expect(400);
  });
});
