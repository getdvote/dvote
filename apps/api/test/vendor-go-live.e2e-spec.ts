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
  b1: randomUUID(),
  user: randomUUID(),
  card: randomUUID(),
};

describe('Go-live checklist: GET /api/vendor/go-live (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  const tokens: Record<string, string> = {};
  const staffIds: Record<string, string> = {};

  const get = (who: string) =>
    request(app.getHttpServer())
      .get('/api/vendor/go-live')
      .set('Authorization', `Bearer ${tokens[who]}`);
  const done = async (who = 'admin') => {
    const r = (await get(who).expect(200)).body as {
      steps: { key: string; done: boolean }[];
    };
    return r.steps.filter((s) => s.done).map((s) => s.key);
  };

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
        { id: ids.vendor, name: `New ${run}` },
        // Another merchant that has done everything: never counts for ours.
        {
          id: ids.other,
          name: `Other ${run}`,
          logo_url: 'https://x.test/l.webp',
          banner_url: 'https://x.test/b.webp',
        },
      ],
    });
    await prisma.branches.createMany({
      data: [
        { id: ids.a1, vendor_id: ids.vendor, name: 'A1' },
        {
          id: ids.b1,
          vendor_id: ids.other,
          name: 'B1',
          weekly_hours: [{ day: 0, opensAt: '08:00', closesAt: '22:00' }],
        },
      ],
    });
    await seedStaff('admin', ids.vendor, null, 'vendor_admin');
    await seedStaff('otherCashier', ids.other, ids.b1, 'staff');
    await prisma.point_rules.create({
      data: { vendor_id: ids.other, version: 1, spend_amount: 10 },
    });
    await prisma.rewards.create({
      data: {
        vendor_id: ids.other,
        name: 'Coffee',
        name_ar: 'قهوة',
        image_url: 'https://x.test/r.webp',
        points_cost: 10,
      },
    });
  });

  afterAll(async () => {
    const v = [ids.vendor, ids.other];
    await prisma.$transaction(async (tx) => {
      // point_events is append-only (trigger): bypass triggers for test cleanup only.
      await tx.$executeRawUnsafe(
        'SET LOCAL session_replication_role = replica',
      );
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

  it('a new merchant starts with nothing done, steps in order', async () => {
    const r = (await get('admin').expect(200)).body;
    expect(r.steps).toEqual([
      { key: 'logo', done: false, to: '/storefront' },
      { key: 'banner', done: false, to: '/storefront' },
      { key: 'rule', done: false, to: '/card' },
      { key: 'reward', done: false, to: '/rewards' },
      { key: 'branch_hours', done: false, to: '/branches' },
      { key: 'staff', done: false, to: '/staff' },
      { key: 'test_scan', done: false, to: '/activity' },
    ]);
    expect(r).toMatchObject({
      done: 0,
      total: 7,
      live: false,
      rewards: { active: 0, withPhoto: 0, withArabic: 0 },
      firstScanAt: null,
    });
  });

  it('each step turns done from the data that already exists', async () => {
    await prisma.vendors.update({
      where: { id: ids.vendor },
      data: {
        logo_url: 'https://x.test/logo.webp',
        banner_url: 'https://x.test/banner.webp',
      },
    });
    await prisma.point_rules.create({
      data: { vendor_id: ids.vendor, version: 1, spend_amount: 10 },
    });
    expect(await done()).toEqual(['logo', 'banner', 'rule']);

    // A reward needs both a photo and an Arabic name; archived rewards don't count.
    const reward = await prisma.rewards.create({
      data: {
        vendor_id: ids.vendor,
        name: 'Coffee',
        image_url: 'https://x.test/c.webp',
        points_cost: 100,
      },
    });
    await prisma.rewards.create({
      data: {
        vendor_id: ids.vendor,
        name: 'Old',
        name_ar: 'قديم',
        image_url: 'https://x.test/o.webp',
        points_cost: 50,
        status: 'archived',
      },
    });
    let r = (await get('admin').expect(200)).body;
    expect(r.rewards).toEqual({ active: 1, withPhoto: 1, withArabic: 0 });
    expect(await done()).not.toContain('reward');
    await prisma.rewards.update({
      where: { id: reward.id },
      data: { name_ar: 'قهوة' },
    });
    expect(await done()).toContain('reward');

    // An open branch with hours; a closed branch with hours doesn't count.
    await prisma.branches.update({
      where: { id: ids.a1 },
      data: {
        weekly_hours: [{ day: 6, opensAt: '08:00', closesAt: '23:00' }],
        status: 'closed',
      },
    });
    expect(await done()).not.toContain('branch_hours');
    await prisma.branches.update({
      where: { id: ids.a1 },
      data: { status: 'active' },
    });
    expect(await done()).toContain('branch_hours');

    await seedStaff('cashier', ids.vendor, ids.a1, 'staff');
    expect(await done()).toContain('staff');

    // A collect scan (with its used QR) completes the list.
    const at = new Date();
    await prisma.users.create({
      data: {
        id: ids.user,
        name: 'Tester',
        email: `tester-${run}@test.dvote`,
        auth_user_id: randomUUID(),
      },
    });
    await prisma.cards.create({
      data: {
        id: ids.card,
        user_id: ids.user,
        vendor_id: ids.vendor,
        balance: 5,
        lifetime_points: 5,
      },
    });
    const rule = await prisma.point_rules.findFirstOrThrow({
      where: { vendor_id: ids.vendor },
    });
    const qr = await prisma.qr_codes.create({
      data: {
        user_id: ids.user,
        purpose: 'collect',
        token_hash: createHash('sha256').update(randomUUID()).digest('hex'),
        status: 'used',
        used_at: at,
        used_by_staff_id: staffIds.cashier,
        used_branch_id: ids.a1,
      },
    });
    await prisma.point_events.create({
      data: {
        card_id: ids.card,
        vendor_id: ids.vendor,
        branch_id: ids.a1,
        staff_id: staffIds.cashier,
        qr_code_id: qr.id,
        idempotency_key: randomUUID(),
        type: 'earn',
        delta: 5,
        purchase_amount: 50,
        rule_id: rule.id,
        created_at: at,
      },
    });
    r = (await get('admin').expect(200)).body;
    expect(r).toMatchObject({ done: 7, total: 7, live: true });
    expect(r.firstScanAt).toBe(at.toISOString());
  });

  it('vendor admin only', async () => {
    await seedStaff('manager', ids.vendor, ids.a1, 'branch_manager');
    await get('manager').expect(403);
    await get('cashier').expect(403);
  });
});
