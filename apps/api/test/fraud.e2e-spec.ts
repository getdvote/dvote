import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { SUPABASE_JWKS } from './../src/auth/supabase-jwt.verifier';
import { PrismaService } from './../src/prisma/prisma.service';
import { createTestSigner } from './helpers/test-auth';

const run = randomUUID().slice(0, 8);
const ids = { vendor: randomUUID(), branch: randomUUID(), staff: randomUUID(), rule: randomUUID(), user: randomUUID(), card: randomUUID() };
const DAY = 86_400_000;

describe('Fraud & risk monitoring (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminId = '';
  const tokens: Record<string, string> = {};

  const as = (who: string, method: 'get' | 'post' | 'patch', path: string) =>
    request(app.getHttpServer())[method](path).set('Authorization', `Bearer ${tokens[who]}`);

  /** A used QR + its earn row at a given time (the ledger as the collect flow writes it). */
  async function earn(at: Date, amount: number, points: number) {
    const qr = await prisma.qr_codes.create({
      data: {
        user_id: ids.user,
        purpose: 'collect',
        token_hash: randomUUID().replace(/-/g, '').padEnd(64, '0'),
        status: 'used',
        used_at: at,
        used_by_staff_id: ids.staff,
        used_branch_id: ids.branch,
        expires_at: new Date(at.getTime() + 300_000),
      },
    });
    await prisma.point_events.create({
      data: {
        card_id: ids.card,
        vendor_id: ids.vendor,
        branch_id: ids.branch,
        staff_id: ids.staff,
        rule_id: ids.rule,
        qr_code_id: qr.id,
        type: 'earn',
        delta: points,
        purchase_amount: amount,
        idempotency_key: randomUUID(),
        created_at: at,
      },
    });
    await prisma.cards.update({ where: { id: ids.card }, data: { balance: { increment: points }, lifetime_points: { increment: points } } });
  }

  beforeAll(async () => {
    const signer = await createTestSigner();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(SUPABASE_JWKS).useValue(signer.jwks).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const authId = randomUUID();
    adminId = (await prisma.platform_admins.create({ data: { name: `Fraud ${run}`, email: `fraud-${run}@test.dvote`, auth_user_id: authId } })).id;
    tokens.admin = await signer.sign(authId, { aal: 'aal2' });
    tokens.customer = await signer.sign(randomUUID(), {
      email: `fc-${run}@test.dvote`,
      app_metadata: { provider: 'google', providers: ['google'] },
    });

    await prisma.vendors.create({ data: { id: ids.vendor, name: `Fraud Cafe ${run}` } });
    await prisma.branches.create({ data: { id: ids.branch, vendor_id: ids.vendor, name: 'F1' } });
    await prisma.staff_users.create({
      data: { id: ids.staff, vendor_id: ids.vendor, branch_id: ids.branch, name: 'Sam', email: `sam-${run}@test.dvote`, role: 'staff' },
    });
    await prisma.point_rules.create({ data: { id: ids.rule, vendor_id: ids.vendor, version: 1, spend_amount: 10, points_per_spend: 1 } });
    await prisma.users.create({ data: { id: ids.user, name: 'Suspicious Sue', email: `sue-${run}@test.dvote`, auth_user_id: randomUUID() } });
    await prisma.cards.create({ data: { id: ids.card, user_id: ids.user, vendor_id: ids.vendor } });

    // Normal history: 12 bills of 50 EGP (5 points) over the last 2–13 days.
    for (let i = 0; i < 12; i++) await earn(new Date(Date.now() - (2 + i) * DAY), 50, 5);
    // Today: 4 collects by the same customer (too many), one of them a 1,000 EGP bill (large),
    // making the branch's and the staff member's day 115 points vs ~2 a day (spikes).
    for (const [amount, pts] of [
      [50, 5],
      [50, 5],
      [50, 5],
      [1000, 100],
    ]) {
      await earn(new Date(Date.now() - 60_000), amount, pts);
    }
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
      await tx.fraud_flags.deleteMany({ where: { vendor_id: ids.vendor } });
      await tx.point_events.deleteMany({ where: { vendor_id: ids.vendor } });
      await tx.qr_codes.deleteMany({ where: { user_id: ids.user } });
      await tx.cards.deleteMany({ where: { vendor_id: ids.vendor } });
      await tx.point_rules.deleteMany({ where: { vendor_id: ids.vendor } });
      await tx.staff_users.deleteMany({ where: { vendor_id: ids.vendor } });
      await tx.branches.deleteMany({ where: { vendor_id: ids.vendor } });
      await tx.vendors.deleteMany({ where: { id: ids.vendor } });
      await tx.users.deleteMany({ where: { email: { endsWith: `-${run}@test.dvote` } } });
      await tx.platform_admins.deleteMany({ where: { id: adminId } });
    });
    await app.close();
  });

  it('the check finds all four patterns once; running it again adds nothing', async () => {
    await as('admin', 'post', '/api/admin/fraud/check').expect(201);
    const flags = await prisma.fraud_flags.findMany({ where: { vendor_id: ids.vendor } });
    expect(flags.map((f) => f.type).sort()).toEqual(['branch_spike', 'large_purchase', 'staff_spike', 'too_many_collects']);

    const many = flags.find((f) => f.type === 'too_many_collects')!;
    expect(many).toMatchObject({ user_id: ids.user, status: 'open' });
    expect(many.details).toMatchObject({ collects: 4, points: 115 });
    const large = flags.find((f) => f.type === 'large_purchase')!;
    expect(large).toMatchObject({ branch_id: ids.branch, staff_id: ids.staff, user_id: ids.user });
    expect(Number((large.details as { amount: string }).amount)).toBe(1000);
    expect(flags.find((f) => f.type === 'staff_spike')).toMatchObject({ staff_id: ids.staff });

    const again = (await as('admin', 'post', '/api/admin/fraud/check').expect(201)).body as { created: number };
    expect(again.created).toBe(0);
    expect(await prisma.fraud_flags.count({ where: { vendor_id: ids.vendor } })).toBe(4);
  });

  it('admins list, confirm with a note, reopen; summary counts; customers are refused', async () => {
    const list = (await as('admin', 'get', `/api/admin/fraud/flags?vendorId=${ids.vendor}&status=open`).expect(200)).body as {
      total: number;
      items: { id: string; type: string; user: { name: string } | null; vendor: { name: string } }[];
    };
    expect(list.total).toBe(4);
    const many = list.items.find((i) => i.type === 'too_many_collects')!;
    expect(many.user?.name).toBe('Suspicious Sue');
    expect(many.vendor.name).toBe(`Fraud Cafe ${run}`);

    const confirmed = (await as('admin', 'patch', `/api/admin/fraud/flags/${many.id}`).send({ status: 'confirmed', note: 'Same card, 4 visits' }).expect(200)).body;
    expect(confirmed).toMatchObject({ status: 'confirmed', reviewedBy: { id: adminId }, details: { review: { note: 'Same card, 4 visits' } } });
    // A reviewed flag must name its reviewer (database CHECK) — and it does.
    expect((await prisma.fraud_flags.findUniqueOrThrow({ where: { id: many.id } })).reviewed_by).toBe(adminId);

    const summary = (await as('admin', 'get', '/api/admin/fraud/summary').expect(200)).body;
    expect(summary.confirmed).toBeGreaterThanOrEqual(1);
    expect(summary.openByType.large_purchase).toBeGreaterThanOrEqual(1);
    expect(summary.rules).toMatchObject({ maxCollectsPerDay: 3, largePurchaseFactor: 5, spikeFactor: 3 });

    const reopened = (await as('admin', 'patch', `/api/admin/fraud/flags/${many.id}`).send({ status: 'open' }).expect(200)).body;
    expect(reopened).toMatchObject({ status: 'open', reviewedBy: null });

    await as('admin', 'patch', `/api/admin/fraud/flags/${randomUUID()}`).send({ status: 'dismissed' }).expect(404);
    await as('customer', 'get', '/api/admin/fraud/flags').expect(403);
  });
});
