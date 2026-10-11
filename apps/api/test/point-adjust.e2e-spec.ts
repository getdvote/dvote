import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { SUPABASE_JWKS } from './../src/auth/supabase-jwt.verifier';
import { PrismaService } from './../src/prisma/prisma.service';
import { createTestSigner, type TestSigner } from './helpers/test-auth';

const run = randomUUID().slice(0, 8);
const ids = { vendor: randomUUID(), branch: randomUUID() };

describe('Admin point corrections: adjust a card, undo a mistyped collect (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  const tokens: Record<string, string> = {};
  const customerSub = randomUUID();
  let adminId = '';
  let userId = '';

  const as = (who: string, method: 'get' | 'post', path: string) =>
    request(app.getHttpServer())[method](path).set('Authorization', `Bearer ${tokens[who]}`);

  async function earn(amount: number): Promise<string> {
    const { code } = (await as('customer', 'post', '/api/app/qr-codes').send({ purpose: 'collect' }).expect(201)).body as { code: string };
    const res = await as('staff', 'post', '/api/vendor/scans/collect').send({ code, amount, idempotencyKey: randomUUID() }).expect(200);
    return res.body.pointEventId as string;
  }

  async function card() {
    return prisma.cards.findFirstOrThrow({ where: { vendor_id: ids.vendor, user_id: userId } });
  }

  async function expectLedgerMatches() {
    const c = await card();
    const sum = await prisma.point_events.aggregate({ where: { card_id: c.id }, _sum: { delta: true } });
    expect(c.balance).toBe(sum._sum.delta ?? 0);
  }

  beforeAll(async () => {
    signer = await createTestSigner();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(SUPABASE_JWKS).useValue(signer.jwks).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const adminAuth = randomUUID();
    adminId = (await prisma.platform_admins.create({ data: { name: `Adj ${run}`, email: `adj-${run}@test.dvote`, auth_user_id: adminAuth } })).id;
    tokens.admin = await signer.sign(adminAuth, { aal: 'aal2' });

    await prisma.vendors.create({ data: { id: ids.vendor, name: `Adjust ${run}` } });
    await prisma.branches.create({ data: { id: ids.branch, vendor_id: ids.vendor, name: 'Main' } });
    await prisma.point_rules.create({ data: { vendor_id: ids.vendor, version: 1, spend_amount: 10, points_per_spend: 1 } });
    const staffAuth = randomUUID();
    await prisma.staff_users.create({
      data: { vendor_id: ids.vendor, branch_id: ids.branch, name: 'Cashier', email: `cash-${run}@test.dvote`, role: 'staff', auth_user_id: staffAuth },
    });
    tokens.staff = await signer.sign(staffAuth);
    tokens.customer = await signer.sign(customerSub, {
      email: `adjc-${run}@test.dvote`,
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: 'Adjust Customer' },
    });
    userId = (await as('customer', 'get', '/api/app/users/me').expect(200)).body.id;
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
      await tx.point_events.deleteMany({ where: { vendor_id: ids.vendor } });
      await tx.cards.deleteMany({ where: { vendor_id: ids.vendor } });
      await tx.qr_codes.deleteMany({ where: { user_id: userId } });
      await tx.point_rules.deleteMany({ where: { vendor_id: ids.vendor } });
      await tx.staff_users.deleteMany({ where: { vendor_id: ids.vendor } });
      await tx.branches.deleteMany({ where: { vendor_id: ids.vendor } });
      await tx.vendors.deleteMany({ where: { id: ids.vendor } });
      await tx.users.deleteMany({ where: { id: userId } });
      await tx.platform_admins.deleteMany({ where: { id: adminId } });
    });
    await app.close();
  });

  it('undo a mistyped collect: 950 instead of 95 → 95 points taken back, once only', async () => {
    await earn(100); // 10 pts
    const wrong = await earn(950); // 95 pts (should have been 9)
    expect((await card()).balance).toBe(105);

    const res = await as('admin', 'post', `/api/admin/point-events/${wrong}/reverse`).send({ reason: 'Typed 950 instead of 95' }).expect(200);
    expect(res.body).toMatchObject({ delta: -95, cardBalance: 10, lifetimePoints: 10, reason: 'Typed 950 instead of 95' });
    const row = await prisma.point_events.findUniqueOrThrow({ where: { id: res.body.pointEventId } });
    expect(row).toMatchObject({ type: 'adjust', created_by: adminId, branch_id: null, vendor_id: ids.vendor });
    await expectLedgerMatches();

    expect((await as('admin', 'post', `/api/admin/point-events/${wrong}/reverse`).send({ reason: 'again' }).expect(409)).body.code).toBe('already_reversed');
    // The admin customer view marks it reversed and shows the admin's name on the correction.
    const detail = (await as('admin', 'get', `/api/admin/users/${userId}`).expect(200)).body as {
      events: { id: string; reversed: boolean; adminName: string | null; type: string }[];
    };
    expect(detail.events.find((e) => e.id === wrong)?.reversed).toBe(true);
    expect(detail.events.find((e) => e.type === 'adjust')?.adminName).toBe(`Adj ${run}`);

    // History a page at a time: 3 rows (2 collects + the undo), 2 per page.
    const p1 = (await as('admin', 'get', `/api/admin/users/${userId}/events?page=1&pageSize=2`).expect(200)).body;
    const p2 = (await as('admin', 'get', `/api/admin/users/${userId}/events?page=2&pageSize=2`).expect(200)).body;
    expect(p1).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(p1.items).toHaveLength(2);
    expect(p2.items).toHaveLength(1);
    expect(p1.items[0].type).toBe('adjust');
    await as('admin', 'get', `/api/admin/users/${userId}/events?pageSize=51`).expect(400);
  });

  it('adjust: add / take points with a reason; never below 0; same key = applied once', async () => {
    const c = await card();
    const key = randomUUID();
    const add = await as('admin', 'post', `/api/admin/cards/${c.id}/adjust`).send({ delta: 40, reason: 'Goodwill', idempotencyKey: key }).expect(200);
    expect(add.body.cardBalance).toBe(50);
    const again = await as('admin', 'post', `/api/admin/cards/${c.id}/adjust`).send({ delta: 40, reason: 'Goodwill', idempotencyKey: key }).expect(200);
    expect(again.body.pointEventId).toBe(add.body.pointEventId);
    expect((await card()).balance).toBe(50);

    expect((await as('admin', 'post', `/api/admin/cards/${c.id}/adjust`).send({ delta: -51, reason: 'Too much' }).expect(409)).body.code).toBe('insufficient_points');
    await as('admin', 'post', `/api/admin/cards/${c.id}/adjust`).send({ delta: 0, reason: 'Nothing' }).expect(400);
    await as('admin', 'post', `/api/admin/cards/${c.id}/adjust`).send({ delta: 5 }).expect(400);
    expect((await as('admin', 'post', `/api/admin/cards/${randomUUID()}/adjust`).send({ delta: 5, reason: 'abc' }).expect(404)).body.code).toBe('card_not_found');
    await expectLedgerMatches();
  });

  it('only collects can be undone; spent points cannot be undone; non-admins get 403', async () => {
    const adjustRow = await prisma.point_events.findFirstOrThrow({ where: { vendor_id: ids.vendor, type: 'adjust' } });
    expect((await as('admin', 'post', `/api/admin/point-events/${adjustRow.id}/reverse`).send({ reason: 'abc' }).expect(409)).body.code).toBe('not_reversible');
    expect((await as('admin', 'post', `/api/admin/point-events/${randomUUID()}/reverse`).send({ reason: 'abc' }).expect(404)).body.code).toBe('point_event_not_found');

    const c = await card();
    await as('admin', 'post', `/api/admin/cards/${c.id}/adjust`).send({ delta: -50, reason: 'Clear' }).expect(200);
    const big = await earn(200); // 20 pts
    await as('admin', 'post', `/api/admin/cards/${c.id}/adjust`).send({ delta: -15, reason: 'Spent elsewhere' }).expect(200);
    expect((await as('admin', 'post', `/api/admin/point-events/${big}/reverse`).send({ reason: 'abc' }).expect(409)).body.code).toBe('insufficient_points');

    await as('staff', 'post', `/api/admin/cards/${c.id}/adjust`).send({ delta: 5, reason: 'abc' }).expect(403);
    await as('customer', 'post', `/api/admin/point-events/${big}/reverse`).send({ reason: 'abc' }).expect(403);
    await expectLedgerMatches();
  });
});
