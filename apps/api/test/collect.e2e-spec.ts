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
const ids = {
  vendorA: randomUUID(),
  vendorB: randomUUID(),
  vendorNoRule: randomUUID(),
  branchA1: randomUUID(),
  branchA2: randomUUID(),
  branchB1: randomUUID(),
  branchN1: randomUUID(),
  ruleA1: randomUUID(),
};

describe('Collect points: QR codes, scans, cards (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  const tokens: Record<string, string> = {};
  const customerSubs: string[] = [];

  const http = () => request(app.getHttpServer());
  const as = (who: string, method: 'get' | 'post' | 'patch', path: string) =>
    http()[method](path).set('Authorization', `Bearer ${tokens[who]}`);

  async function seedStaff(
    key: string,
    vendorId: string,
    branchId: string | null,
    role: staff_role,
  ) {
    const authId = randomUUID();
    await prisma.staff_users.create({
      data: {
        vendor_id: vendorId,
        branch_id: branchId,
        name: key,
        email: `${key}-${run}@test.dvote`,
        role,
        auth_user_id: authId,
      },
    });
    tokens[key] = await signer.sign(authId);
  }

  async function seedCustomer(key: string) {
    const sub = randomUUID();
    customerSubs.push(sub);
    tokens[key] = await signer.sign(sub, {
      email: `${key}-${run}@test.dvote`,
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: key },
    });
    // first call creates the customer row
    await as(key, 'get', '/api/app/users/me').expect(200);
  }

  /** Customer gets a QR; returns {id, code}. */
  async function qr(customer: string) {
    const res = await as(customer, 'post', '/api/app/qr-codes')
      .send({ purpose: 'collect' })
      .expect(201);
    return res.body as { id: string; code: string; vendorId: string | null };
  }

  const collect = (staff: string, body: Record<string, unknown>) =>
    as(staff, 'post', '/api/vendor/scans/collect').send({
      idempotencyKey: randomUUID(),
      ...body,
    });

  async function cardOf(customer: string, vendorId: string) {
    const res = await as(customer, 'get', '/api/app/cards').expect(200);
    return (
      res.body as { id: string; vendor: { id: string }; balance: number }[]
    ).find((c) => c.vendor.id === vendorId);
  }

  async function ledgerMatches(cardId: string) {
    const card = await prisma.cards.findUniqueOrThrow({
      where: { id: cardId },
    });
    const sum = await prisma.point_events.aggregate({
      where: { card_id: cardId },
      _sum: { delta: true },
    });
    expect(card.balance).toBe(sum._sum.delta ?? 0);
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
        { id: ids.vendorA, name: `Collect A ${run}` },
        { id: ids.vendorB, name: `Collect B ${run}` },
        { id: ids.vendorNoRule, name: `Collect NoRule ${run}` },
      ],
    });
    await prisma.branches.createMany({
      data: [
        { id: ids.branchA1, vendor_id: ids.vendorA, name: 'A1' },
        { id: ids.branchA2, vendor_id: ids.vendorA, name: 'A2' },
        { id: ids.branchB1, vendor_id: ids.vendorB, name: 'B1' },
        { id: ids.branchN1, vendor_id: ids.vendorNoRule, name: 'N1' },
      ],
    });
    await prisma.point_rules.createMany({
      data: [
        {
          id: ids.ruleA1,
          vendor_id: ids.vendorA,
          version: 1,
          spend_amount: 10,
          points_per_spend: 1,
        },
        {
          vendor_id: ids.vendorB,
          version: 1,
          spend_amount: 5,
          points_per_spend: 1,
        },
      ],
    });
    await prisma.rewards.createMany({
      data: [
        { vendor_id: ids.vendorA, name: 'Free coffee', points_cost: 30 },
        { vendor_id: ids.vendorA, name: 'Free cake', points_cost: 50 },
      ],
    });
    await seedStaff('staffA1', ids.vendorA, ids.branchA1, 'staff');
    await seedStaff('adminA', ids.vendorA, null, 'vendor_admin');
    await seedStaff('staffB1', ids.vendorB, ids.branchB1, 'staff');
    await seedStaff('staffN1', ids.vendorNoRule, ids.branchN1, 'staff');
    for (const c of ['karim', 'mona', 'blocked']) await seedCustomer(c);
  });

  afterAll(async () => {
    const vendorIds = Object.values(ids).filter((_, i) => i < 3);
    const users = await prisma.users.findMany({
      where: { auth_user_id: { in: customerSubs } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    // point_events is append-only (trigger): bypass triggers for test cleanup only.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL session_replication_role = replica`,
      );
      await tx.point_events.deleteMany({
        where: { vendor_id: { in: vendorIds } },
      });
      await tx.cards.deleteMany({ where: { vendor_id: { in: vendorIds } } });
      await tx.qr_codes.deleteMany({ where: { user_id: { in: userIds } } });
      await tx.rewards.deleteMany({ where: { vendor_id: { in: vendorIds } } });
      await tx.point_rules.deleteMany({
        where: { vendor_id: { in: vendorIds } },
      });
      await tx.staff_users.deleteMany({
        where: { vendor_id: { in: vendorIds } },
      });
      await tx.branches.deleteMany({ where: { vendor_id: { in: vendorIds } } });
      await tx.vendors.deleteMany({ where: { id: { in: vendorIds } } });
      await tx.users.deleteMany({ where: { id: { in: userIds } } });
    });
    await app.close();
  });

  describe('staff app context (GET /api/vendor/staff/me)', () => {
    it('branch staff: vendor, own branch, the rule', async () => {
      const res = await as('staffA1', 'get', '/api/vendor/staff/me').expect(
        200,
      );
      expect(res.body).toMatchObject({
        role: 'staff',
        vendor: {
          id: ids.vendorA,
          name: `Collect A ${run}`,
          currency: 'EGP',
          logoUrl: null,
        },
        branch: { id: ids.branchA1, name: 'A1' },
        branches: [{ id: ids.branchA1, name: 'A1' }],
        activeRule: {
          version: 1,
          spendAmount: '10.00',
          pointsPerSpend: 1,
          minPurchase: '0.00',
          maxPointsPerPurchase: null,
        },
      });
    });

    it('vendor admin: no own branch, can pick any active branch of the vendor', async () => {
      const res = await as('adminA', 'get', '/api/vendor/staff/me').expect(200);
      expect(res.body.branch).toBeNull();
      expect(res.body.branches.map((b: { name: string }) => b.name)).toEqual([
        'A1',
        'A2',
      ]);
    });

    it('vendor without a rule: activeRule null', async () => {
      const res = await as('staffN1', 'get', '/api/vendor/staff/me').expect(
        200,
      );
      expect(res.body.activeRule).toBeNull();
    });
  });

  describe('happy path', () => {
    it('no card before the first purchase', async () => {
      expect(await cardOf('karim', ids.vendorA)).toBeUndefined();
    });

    it('master QR → preview → collect 95.50 → 9 points; customer sees it; card created', async () => {
      const { id, code } = await qr('karim');
      expect(code).toMatch(/^dvote:q1:/);

      const preview = await as('staffA1', 'post', '/api/vendor/scans/preview')
        .send({ code })
        .expect(200);
      expect(preview.body).toMatchObject({
        purpose: 'collect',
        usable: true,
        reason: null,
      });

      const res = await collect('staffA1', {
        code,
        amount: 95.5,
        receiptRef: `R-${run}-1`,
      }).expect(200);
      expect(res.body).toMatchObject({
        pointsAdded: 9,
        purchaseAmount: '95.50',
        currency: 'EGP',
        ruleVersion: 1,
        branchId: ids.branchA1,
        branchName: 'A1',
        receiptRef: `R-${run}-1`,
      });

      const status = await as('karim', 'get', `/api/app/qr-codes/${id}`).expect(
        200,
      );
      expect(status.body).toMatchObject({
        status: 'used',
        result: {
          pointsAdded: 9,
          purchaseAmount: '95.50',
          vendorName: `Collect A ${run}`,
          branchName: 'A1',
          cardBalance: 9,
        },
      });

      const cards = await as('karim', 'get', '/api/app/cards').expect(200);
      expect(cards.body).toHaveLength(1);
      expect(cards.body[0]).toMatchObject({
        vendor: { id: ids.vendorA, currency: 'EGP' },
        balance: 9,
        lifetimePoints: 9,
        affordableRewards: 0,
        nextReward: { name: 'Free coffee', pointsCost: 30, pointsNeeded: 21 },
      });
      await ledgerMatches(cards.body[0].id);

      const events = await as(
        'karim',
        'get',
        `/api/app/cards/${cards.body[0].id}/events`,
      ).expect(200);
      expect(events.body).toEqual([
        expect.objectContaining({
          type: 'earn',
          delta: 9,
          purchaseAmount: '95.50',
          branchName: 'A1',
        }),
      ]);
    });

    it('a second purchase adds to the same card', async () => {
      const { code } = await qr('karim');
      await collect('staffA1', { code, amount: 250 }).expect(200);
      const card = await cardOf('karim', ids.vendorA);
      expect(card).toMatchObject({ balance: 34 });
      await ledgerMatches(card!.id);
    });

    it('pages the history with limit and before', async () => {
      const card = await cardOf('karim', ids.vendorA);
      const url = `/api/app/cards/${card!.id}/events`;
      const first = await as('karim', 'get', `${url}?limit=1`).expect(200);
      expect(first.body).toEqual([expect.objectContaining({ delta: 25 })]);
      const second = await as(
        'karim',
        'get',
        `${url}?limit=1&before=${first.body[0].id}`,
      ).expect(200);
      expect(second.body).toEqual([expect.objectContaining({ delta: 9 })]);
      const end = await as(
        'karim',
        'get',
        `${url}?limit=1&before=${second.body[0].id}`,
      ).expect(200);
      expect(end.body).toEqual([]);
      await as('karim', 'get', `${url}?before=nope`).expect(400);
    });

    it('a new rule version applies only to later purchases', async () => {
      await prisma.$transaction([
        prisma.point_rules.update({
          where: { id: ids.ruleA1 },
          data: { is_active: false },
        }),
        prisma.point_rules.create({
          data: {
            vendor_id: ids.vendorA,
            version: 2,
            spend_amount: 10,
            points_per_spend: 2,
          },
        }),
      ]);
      const { code } = await qr('mona');
      const res = await collect('staffA1', { code, amount: 50 }).expect(200);
      expect(res.body).toMatchObject({ pointsAdded: 10, ruleVersion: 2 });
      // karim's earlier events still say version 1
      const old = await prisma.point_events.findMany({
        where: { cards: { users: { auth_user_id: customerSubs[0] } } },
        include: { point_rules: true },
      });
      expect(old.every((e) => e.point_rules?.version === 1)).toBe(true);
    });
  });

  describe('one QR = one purchase', () => {
    it('a QR expires 5 minutes after it is issued (DB and app clocks agree, UTC)', async () => {
      const before = Date.now();
      const res = await as('karim', 'post', '/api/app/qr-codes')
        .send({ purpose: 'collect' })
        .expect(201);
      const ms = new Date(res.body.expiresAt).getTime() - before;
      expect(ms).toBeGreaterThan(4.5 * 60_000);
      expect(ms).toBeLessThan(5.5 * 60_000);
      const [db] = await prisma.$queryRaw<{ now: Date }[]>`select now()`;
      expect(Math.abs(db.now.getTime() - Date.now())).toBeLessThan(60_000);
    });

    it('a used QR is rejected; the same submit retried returns the first result', async () => {
      const { code } = await qr('karim');
      const key = randomUUID();
      const first = await collect('staffA1', {
        code,
        amount: 30,
        idempotencyKey: key,
      }).expect(200);
      const retry = await collect('staffA1', {
        code,
        amount: 30,
        idempotencyKey: key,
      }).expect(200);
      expect(retry.body.pointEventId).toBe(first.body.pointEventId);

      const again = await collect('staffA1', { code, amount: 30 }).expect(409);
      expect(again.body.code).toBe('qr_used');
      expect(
        await prisma.point_events.count({ where: { idempotency_key: key } }),
      ).toBe(1);
    });

    it('an idempotency key from another QR → 409 idempotency_key_reused', async () => {
      const a = await qr('karim');
      const key = randomUUID();
      await collect('staffA1', {
        code: a.code,
        amount: 20,
        idempotencyKey: key,
      }).expect(200);
      const b = await qr('karim');
      const res = await collect('staffA1', {
        code: b.code,
        amount: 20,
        idempotencyKey: key,
      }).expect(409);
      expect(res.body.code).toBe('idempotency_key_reused');
    });

    it('two staff phones submit the same QR at once → exactly one succeeds', async () => {
      const { code } = await qr('mona');
      const before = (await cardOf('mona', ids.vendorA))!.balance;
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          collect('staffA1', { code, amount: 100 }),
        ),
      );
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(4);
      const card = (await cardOf('mona', ids.vendorA))!;
      expect(card.balance).toBe(before + 20);
      await ledgerMatches(card.id);
    });

    it('a new QR cancels the previous one', async () => {
      const old = await qr('karim');
      await qr('karim');
      const res = await collect('staffA1', {
        code: old.code,
        amount: 20,
      }).expect(409);
      expect(res.body.code).toBe('qr_cancelled');
    });

    it('an expired QR → 409 qr_expired; the customer sees "expired"', async () => {
      const { id, code } = await qr('karim');
      await prisma.qr_codes.update({
        where: { id },
        data: { expires_at: new Date(Date.now() - 1000) },
      });
      const res = await collect('staffA1', { code, amount: 20 }).expect(409);
      expect(res.body.code).toBe('qr_expired');
      const status = await as('karim', 'get', `/api/app/qr-codes/${id}`).expect(
        200,
      );
      expect(status.body.status).toBe('expired');
    });

    it('cancel endpoint', async () => {
      const { id, code } = await qr('karim');
      const res = await as(
        'karim',
        'post',
        `/api/app/qr-codes/${id}/cancel`,
      ).expect(200);
      expect(res.body.status).toBe('cancelled');
      await collect('staffA1', { code, amount: 20 }).expect(409);
    });

    it('not a dvote QR → 404 qr_invalid', async () => {
      const res = await collect('staffA1', {
        code: 'hello world',
        amount: 20,
      }).expect(404);
      expect(res.body.code).toBe('qr_invalid');
    });
  });

  describe('vendor and branch rules', () => {
    it("the same kind of QR works at any vendor: the scanning staff's vendor and branch get the points", async () => {
      const first = await qr('karim');
      expect(first.vendorId).toBeNull();
      const atB = await collect('staffB1', {
        code: first.code,
        amount: 20,
      }).expect(200);
      expect(atB.body).toMatchObject({ pointsAdded: 4, branchName: 'B1' }); // B: 5 EGP = 1 point
      expect(await cardOf('karim', ids.vendorB)).toMatchObject({ balance: 4 });

      const second = await qr('karim');
      const atA = await collect('staffA1', {
        code: second.code,
        amount: 20,
      }).expect(200);
      expect(atA.body).toMatchObject({ branchName: 'A1' });
      expect(await cardOf('karim', ids.vendorA)).toBeDefined();
    });

    it('a shop QR (made on a vendor page) works only at that vendor', async () => {
      const res = await as('karim', 'post', '/api/app/qr-codes')
        .send({ purpose: 'collect', vendorId: ids.vendorA })
        .expect(201);
      expect(res.body.vendorId).toBe(ids.vendorA);
      const code = res.body.code as string;

      // Another vendor's staff: told it's the wrong shop, nothing written, QR still usable.
      const preview = await as('staffB1', 'post', '/api/vendor/scans/preview')
        .send({ code })
        .expect(200);
      expect(preview.body).toMatchObject({ usable: false, reason: 'vendor_mismatch' });
      const before = await prisma.point_events.count({ where: { vendor_id: ids.vendorB } });
      const wrong = await collect('staffB1', { code, amount: 20 }).expect(403);
      expect(wrong.body.code).toBe('vendor_mismatch');
      expect(await prisma.point_events.count({ where: { vendor_id: ids.vendorB } })).toBe(before);

      // The right vendor's staff: points go to that vendor.
      const ok = await collect('staffA1', { code, amount: 20 }).expect(200);
      expect(ok.body).toMatchObject({ branchName: 'A1' });
    });

    it('a shop QR for an unknown vendor → 404 vendor_not_found', async () => {
      const res = await as('karim', 'post', '/api/app/qr-codes')
        .send({ purpose: 'collect', vendorId: randomUUID() })
        .expect(404);
      expect(res.body.code).toBe('vendor_not_found');
    });

    it('vendor admin must choose a branch of their vendor', async () => {
      const { code } = await qr('karim');
      const missing = await collect('adminA', { code, amount: 20 }).expect(400);
      expect(missing.body.code).toBe('branch_required');
      const other = await collect('adminA', {
        code,
        amount: 20,
        branchId: ids.branchB1,
      }).expect(400);
      expect(other.body.code).toBe('invalid_branch');
      const ok = await collect('adminA', {
        code,
        amount: 20,
        branchId: ids.branchA2,
      }).expect(200);
      expect(ok.body.branchName).toBe('A2');
    });

    it("branch staff can't book a sale on another branch → 403 forbidden_branch", async () => {
      const { code } = await qr('karim');
      const res = await collect('staffA1', {
        code,
        amount: 20,
        branchId: ids.branchA2,
      }).expect(403);
      expect(res.body.code).toBe('forbidden_branch');
    });

    it('a vendor without a point rule → 409 no_active_rule (told at preview, before the bill)', async () => {
      const { code } = await qr('karim');
      const preview = await as('staffN1', 'post', '/api/vendor/scans/preview').send({ code }).expect(200);
      expect(preview.body).toMatchObject({ usable: false, reason: 'no_active_rule' });
      const res = await collect('staffN1', { code, amount: 20 }).expect(409);
      expect(res.body.code).toBe('no_active_rule');

      // The customer can't even open a shop QR for a shop without a rule.
      const shopQr = await as('karim', 'post', '/api/app/qr-codes').send({ purpose: 'collect', vendorId: ids.vendorNoRule }).expect(409);
      expect(shopQr.body.code).toBe('no_active_rule');
    });
  });

  describe('amounts and receipts', () => {
    it('below one point → 422 no_points_earned; nothing written; the QR still works', async () => {
      const { id, code } = await qr('karim');
      const res = await collect('staffA1', { code, amount: 4 }).expect(422);
      expect(res.body.code).toBe('no_points_earned');
      expect(
        await prisma.point_events.count({ where: { qr_code_id: id } }),
      ).toBe(0);
      await collect('staffA1', { code, amount: 40 }).expect(200);
    });

    it('a receipt number earns once per branch → 409 duplicate_receipt', async () => {
      const ref = `R-${run}-dup`;
      const a = await qr('karim');
      await collect('staffA1', {
        code: a.code,
        amount: 20,
        receiptRef: ref,
      }).expect(200);
      const b = await qr('karim');
      const res = await collect('staffA1', {
        code: b.code,
        amount: 20,
        receiptRef: ref,
      }).expect(409);
      expect(res.body.code).toBe('duplicate_receipt');
    });

    it.each([
      ['3 decimals', 10.005],
      ['zero', 0],
      ['negative', -5],
      ['a string', '95'],
      ['too large', 2_000_000],
    ])('amount %s → 400', async (_label, amount) => {
      const { code } = await qr('karim');
      await collect('staffA1', { code, amount }).expect(400);
    });

    it('missing idempotencyKey → 400', async () => {
      const { code } = await qr('karim');
      await as('staffA1', 'post', '/api/vendor/scans/collect')
        .send({ code, amount: 20 })
        .expect(400);
    });
  });

  describe('customers', () => {
    it('blocked customer → 403 user_blocked at the counter', async () => {
      const { code } = await qr('blocked');
      await prisma.users.updateMany({
        where: { auth_user_id: customerSubs[2] },
        data: { status: 'blocked' },
      });
      const res = await collect('staffA1', { code, amount: 20 }).expect(403);
      expect(res.body.code).toBe('user_blocked');
    });

    it("customers can't see each other's QR codes or cards", async () => {
      const { id } = await qr('karim');
      await as('mona', 'get', `/api/app/qr-codes/${id}`).expect(404);
      const karimCard = (await cardOf('karim', ids.vendorA))!;
      await as('mona', 'get', `/api/app/cards/${karimCard.id}/events`).expect(
        404,
      );
    });

    it('anonymous logins cannot get QR codes → 403 provider_not_allowed', async () => {
      tokens.anon = await signer.sign(randomUUID(), { is_anonymous: true });
      const res = await as('anon', 'post', '/api/app/qr-codes')
        .send({ purpose: 'collect' })
        .expect(403);
      expect(res.body.code).toBe('provider_not_allowed');
    });

    it('every card still matches its ledger', async () => {
      const cards = await prisma.cards.findMany({
        where: { vendor_id: { in: [ids.vendorA, ids.vendorB] } },
      });
      expect(cards.length).toBeGreaterThan(0);
      for (const c of cards) await ledgerMatches(c.id);
    });
  });
});
