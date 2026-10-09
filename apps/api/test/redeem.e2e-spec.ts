import { randomUUID } from 'node:crypto';
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
const ids = { vendorA: randomUUID(), vendorB: randomUUID(), branchA1: randomUUID(), branchB1: randomUUID() };

describe('Redeem a reward: customer QR → staff confirm (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  const tokens: Record<string, string> = {};
  const customerSubs: string[] = [];
  const rewards = { coffee: '', cake: '', other: '' };

  const as = (who: string, method: 'get' | 'post' | 'patch', path: string) =>
    request(app.getHttpServer())[method](path).set('Authorization', `Bearer ${tokens[who]}`);

  async function seedStaff(key: string, vendorId: string, branchId: string | null, role: staff_role) {
    const authId = randomUUID();
    await prisma.staff_users.create({
      data: { vendor_id: vendorId, branch_id: branchId, name: key, email: `${key}-${run}@test.dvote`, role, auth_user_id: authId },
    });
    tokens[key] = await signer.sign(authId);
  }

  async function seedCustomer(key: string, name: string) {
    const sub = randomUUID();
    customerSubs.push(sub);
    tokens[key] = await signer.sign(sub, {
      email: `${key}-${run}@test.dvote`,
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: name },
    });
    await as(key, 'get', '/api/app/users/me').expect(200);
  }

  /** Earn points at vendor A the normal way (10 EGP = 1 point). */
  async function earn(customer: string, amount: number) {
    const { code } = (await as(customer, 'post', '/api/app/qr-codes').send({ purpose: 'collect' }).expect(201)).body as { code: string };
    await as('staffA1', 'post', '/api/vendor/scans/collect').send({ code, amount, idempotencyKey: randomUUID() }).expect(200);
  }

  const redeemQr = (customer: string, rewardId: string) => as(customer, 'post', '/api/app/qr-codes').send({ purpose: 'redeem', rewardId });
  const confirm = (staff: string, code: string, key = randomUUID()) =>
    as(staff, 'post', '/api/vendor/scans/redeem').send({ code, idempotencyKey: key });

  async function cardA(customer: string) {
    const cards = (await as(customer, 'get', '/api/app/cards').expect(200)).body as { id: string; vendor: { id: string }; balance: number }[];
    return cards.find((c) => c.vendor.id === ids.vendorA)!;
  }

  /** cards.balance must always equal the ledger sum. */
  async function expectLedgerMatches() {
    const rows = await prisma.$queryRaw<{ balance: number; ledger: bigint }[]>`
      SELECT c.balance, COALESCE(SUM(e.delta), 0) AS ledger
      FROM cards c LEFT JOIN point_events e ON e.card_id = c.id
      WHERE c.vendor_id = ${ids.vendorA}::uuid GROUP BY c.id, c.balance`;
    for (const r of rows) expect(r.balance).toBe(Number(r.ledger));
  }

  beforeAll(async () => {
    signer = await createTestSigner();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(SUPABASE_JWKS).useValue(signer.jwks).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.vendors.createMany({ data: [{ id: ids.vendorA, name: `Redeem A ${run}` }, { id: ids.vendorB, name: `Redeem B ${run}` }] });
    await prisma.branches.createMany({
      data: [
        { id: ids.branchA1, vendor_id: ids.vendorA, name: 'A1' },
        { id: ids.branchB1, vendor_id: ids.vendorB, name: 'B1' },
      ],
    });
    await prisma.point_rules.create({ data: { vendor_id: ids.vendorA, version: 1, spend_amount: 10, points_per_spend: 1 } });
    rewards.coffee = (await prisma.rewards.create({ data: { vendor_id: ids.vendorA, name: 'Free coffee', name_ar: 'قهوة مجانية', points_cost: 300 } })).id;
    rewards.cake = (await prisma.rewards.create({ data: { vendor_id: ids.vendorA, name: 'Cheesecake', points_cost: 500 } })).id;
    rewards.other = (await prisma.rewards.create({ data: { vendor_id: ids.vendorB, name: 'B reward', points_cost: 10 } })).id;
    await seedStaff('staffA1', ids.vendorA, ids.branchA1, 'staff');
    await seedStaff('adminA', ids.vendorA, null, 'vendor_admin');
    await seedStaff('staffB1', ids.vendorB, ids.branchB1, 'staff');
    await seedCustomer('mona', 'Mona Ali');
    await seedCustomer('omar', 'Omar Hassan');
  });

  afterAll(async () => {
    const v = [ids.vendorA, ids.vendorB];
    const users = await prisma.users.findMany({ where: { auth_user_id: { in: customerSubs } }, select: { id: true } });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
      await tx.redemptions.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.point_events.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.cards.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.qr_codes.deleteMany({ where: { user_id: { in: users.map((u) => u.id) } } });
      await tx.rewards.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.point_rules.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.staff_users.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.branches.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.vendors.deleteMany({ where: { id: { in: v } } });
      await tx.users.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    });
    await app.close();
  });

  it('no card / not enough points → the app gets 409 insufficient_points, no QR', async () => {
    expect((await redeemQr('mona', rewards.coffee).expect(409)).body.code).toBe('insufficient_points');
    await earn('mona', 1000); // 100 points
    expect((await redeemQr('mona', rewards.coffee).expect(409)).body.code).toBe('insufficient_points');
    await earn('mona', 9000); // +900 → 1000
    expect((await cardA('mona')).balance).toBe(1000);
  });

  it('1000 − 300 = 700: QR → staff preview (reward + customer) → confirm → customer sees it', async () => {
    const qr = (await redeemQr('mona', rewards.coffee).expect(201)).body as {
      id: string;
      code: string;
      vendorId: string;
      reward: { name: string; pointsCost: number };
    };
    expect(qr.vendorId).toBe(ids.vendorA);
    expect(qr.reward).toMatchObject({ name: 'Free coffee', pointsCost: 300 });

    const preview = (await as('staffA1', 'post', '/api/vendor/scans/preview').send({ code: qr.code }).expect(200)).body;
    expect(preview).toMatchObject({
      purpose: 'redeem',
      usable: true,
      reason: null,
      redeem: { rewardName: 'Free coffee', rewardNameAr: 'قهوة مجانية', pointsCost: 300, customerName: 'Mona Ali', balance: 1000, balanceAfter: 700 },
    });

    const done = (await confirm('staffA1', qr.code).expect(200)).body;
    expect(done).toMatchObject({ rewardName: 'Free coffee', pointsRedeemed: 300, cardBalance: 700, branchName: 'A1' });

    // The customer's polling QR screen and cards
    const status = (await as('mona', 'get', `/api/app/qr-codes/${qr.id}`).expect(200)).body;
    expect(status).toMatchObject({ status: 'used', result: null, redeemResult: { rewardName: 'Free coffee', pointsRedeemed: 300, cardBalance: 700, branchName: 'A1' } });
    expect((await cardA('mona')).balance).toBe(700);
    const events = (await as('mona', 'get', `/api/app/cards/${(await cardA('mona')).id}/events`).expect(200)).body as { type: string; delta: number }[];
    expect(events[0]).toMatchObject({ type: 'redeem', delta: -300 });

    // The same QR can't be used twice.
    expect((await confirm('staffA1', qr.code).expect(409)).body.code).toBe('qr_used');
    await expectLedgerMatches();
  });

  it('same idempotency key twice → points taken once, same answer', async () => {
    const { code } = (await redeemQr('mona', rewards.coffee).expect(201)).body as { code: string };
    const key = randomUUID();
    const first = (await confirm('staffA1', code, key).expect(200)).body;
    const again = (await confirm('staffA1', code, key).expect(200)).body;
    expect(again).toEqual(first);
    expect((await cardA('mona')).balance).toBe(400);
    await expectLedgerMatches();
  });

  it('two staff phones confirm the same QR at once → exactly one succeeds', async () => {
    const { code } = (await redeemQr('mona', rewards.coffee).expect(201)).body as { code: string };
    const results = await Promise.all([
      confirm('staffA1', code),
      as('adminA', 'post', '/api/vendor/scans/redeem').send({ code, branchId: ids.branchA1, idempotencyKey: randomUUID() }),
    ]);
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect((await cardA('mona')).balance).toBe(100);
    await expectLedgerMatches();
  });

  it('only the reward’s shop can give it → another vendor gets vendor_mismatch; nothing taken', async () => {
    await earn('omar', 5000); // 500 points
    const { code } = (await redeemQr('omar', rewards.coffee).expect(201)).body as { code: string };
    const preview = (await as('staffB1', 'post', '/api/vendor/scans/preview').send({ code }).expect(200)).body;
    expect(preview).toMatchObject({ usable: false, reason: 'vendor_mismatch', redeem: null });
    expect((await confirm('staffB1', code).expect(403)).body.code).toBe('vendor_mismatch');
    expect((await cardA('omar')).balance).toBe(500);
    // A redeem QR can't be used to collect either.
    expect(
      (await as('staffA1', 'post', '/api/vendor/scans/collect').send({ code, amount: 50, idempotencyKey: randomUUID() }).expect(400)).body.code,
    ).toBe('wrong_qr_type');
    // …and a collect QR can't be confirmed as a redeem.
    const collectQr = (await as('omar', 'post', '/api/app/qr-codes').send({ purpose: 'collect' }).expect(201)).body as { code: string };
    expect((await confirm('staffA1', collectQr.code).expect(400)).body.code).toBe('wrong_qr_type');
  });

  it('balance spent elsewhere after the QR was made → insufficient_points at the counter', async () => {
    const qrCake = (await redeemQr('omar', rewards.cake).expect(201)).body as { code: string }; // 500 of 500
    // The customer redeems a coffee first (which also cancels the cake QR: one redeem QR at a time)
    const qrCoffee = (await redeemQr('omar', rewards.coffee).expect(201)).body as { code: string };
    expect((await confirm('staffA1', qrCake.code).expect(409)).body.code).toBe('qr_cancelled');
    await confirm('staffA1', qrCoffee.code).expect(200); // 500 → 200
    expect((await redeemQr('omar', rewards.cake).expect(409)).body.code).toBe('insufficient_points');
    await expectLedgerMatches();
  });

  it('archived reward → reward_unavailable (QR request and at the counter)', async () => {
    await earn('omar', 3000); // 200 + 300 = 500
    const { code } = (await redeemQr('omar', rewards.cake).expect(201)).body as { code: string };
    await prisma.rewards.update({ where: { id: rewards.cake }, data: { status: 'archived' } });
    const preview = (await as('staffA1', 'post', '/api/vendor/scans/preview').send({ code }).expect(200)).body;
    expect(preview).toMatchObject({ usable: false, reason: 'reward_unavailable' });
    expect((await confirm('staffA1', code).expect(409)).body.code).toBe('reward_unavailable');
    expect((await redeemQr('omar', rewards.cake).expect(409)).body.code).toBe('reward_unavailable');
    await prisma.rewards.update({ where: { id: rewards.cake }, data: { status: 'active' } });
  });

  it('a price change later does not change past redemptions (snapshot)', async () => {
    await prisma.rewards.update({ where: { id: rewards.coffee }, data: { points_cost: 350, name: 'Coffee (large)' } });
    const past = await prisma.redemptions.findMany({ where: { reward_id: rewards.coffee } });
    expect(past.length).toBeGreaterThan(0);
    for (const r of past) expect(r).toMatchObject({ reward_name: 'Free coffee', points_cost: 300 });
  });

  it('reward history: each customer sees only their own redemptions, newest first', async () => {
    type History = { count: number; pointsSpent: number; items: { at: string; branchName: string; pointsCost: number; rewardName: string }[] };
    const mona = (await as('mona', 'get', `/api/app/rewards/${rewards.coffee}/history`).expect(200)).body as History;
    expect(mona.count).toBe(3); // 1000 → 700 → 400 → 100
    expect(mona.pointsSpent).toBe(900);
    expect(mona.items).toHaveLength(3);
    expect(mona.items[0]).toMatchObject({ branchName: 'A1', pointsCost: 300, rewardName: 'Free coffee' });
    expect(new Date(mona.items[0].at) >= new Date(mona.items[2].at)).toBe(true);

    const omar = (await as('omar', 'get', `/api/app/rewards/${rewards.coffee}/history`).expect(200)).body as History;
    expect(omar.count).toBe(1); // only his own
    expect((await as('omar', 'get', `/api/app/rewards/${randomUUID()}/history`).expect(200)).body).toEqual({ count: 0, pointsSpent: 0, items: [] });  });

  it('request rules: rewardId required for redeem; vendorId not allowed with redeem; unknown reward → 404', async () => {
    await as('mona', 'post', '/api/app/qr-codes').send({ purpose: 'redeem' }).expect(400);
    await as('mona', 'post', '/api/app/qr-codes').send({ purpose: 'redeem', rewardId: rewards.coffee, vendorId: ids.vendorA }).expect(400);
    await as('mona', 'post', '/api/app/qr-codes').send({ purpose: 'collect', rewardId: rewards.coffee }).expect(400);
    expect((await redeemQr('mona', randomUUID()).expect(404)).body.code).toBe('reward_not_found');
  });
});
