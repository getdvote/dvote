import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { SUPABASE_JWKS } from './../src/auth/supabase-jwt.verifier';
import { defaultDesign } from './../src/loyalty-cards/card-design';
import { PrismaService } from './../src/prisma/prisma.service';
import { StorageService } from './../src/storage/storage.service';
import { SupabaseAdminService } from './../src/supabase/supabase-admin.service';
import { FakeStorage } from './helpers/fake-storage';
import { createTestSigner, type TestSigner } from './helpers/test-auth';

const run = randomUUID().slice(0, 8);
const DAY = 24 * 60 * 60 * 1000;

/** What each plan includes (src/plans/entitlements.ts), enforced on the merchant's API. */
describe('Plan gating: trial = everything, Regular / Loyal / Chain features and limits (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  let png: Buffer;
  const storage = new FakeStorage();
  const fakeAuthAdmin = {
    inviteUser: jest.fn(() => Promise.resolve({ authUserId: randomUUID(), existing: false })),
    createUserWithPassword: jest.fn(),
    deleteUser: jest.fn(() => Promise.resolve()),
    isConfigured: () => true,
  };
  const vendorIds: string[] = [];
  const http = () => request(app.getHttpServer());

  /** A shop with one open branch and its merchant admin (signed-in token). */
  async function shop(data: { plan_status: 'trial' | 'active'; plan?: string | null }) {
    const v = await prisma.vendors.create({
      data: {
        name: `Gate ${run} ${vendorIds.length}`,
        plan_status: data.plan_status,
        plan: data.plan ?? null,
        ...(data.plan_status === 'trial'
          ? { trial_ends_at: new Date(Date.now() + 10 * DAY), delete_at: new Date(Date.now() + 25 * DAY), self_signup: true }
          : { paid_until: new Date(Date.now() + 20 * DAY), billing_cycle: 'monthly' }),
      },
    });
    vendorIds.push(v.id);
    const branch = await prisma.branches.create({ data: { vendor_id: v.id, name: 'Main' } });
    const sub = randomUUID();
    await prisma.staff_users.create({
      data: { vendor_id: v.id, role: 'vendor_admin', name: 'Owner', email: `gate-${run}-${vendorIds.length}@test.dvote`, auth_user_id: sub },
    });
    const token = await signer.sign(sub, { email: `gate-${run}-${vendorIds.length}@test.dvote` });
    const as = (method: 'get' | 'post' | 'patch' | 'put' | 'delete', path: string) =>
      http()[method](`/api/vendor${path}`).set('Authorization', `Bearer ${token}`);
    return { id: v.id, slug: v.slug, branchId: branch.id, as };
  }
  const setPlan = (id: string, plan: string) => prisma.vendors.update({ where: { id }, data: { plan } });
  const today = new Date().toISOString().slice(0, 10);
  const segment = { name: `VIPs ${run}`, match: 'all', rules: [{ field: 'visits', op: 'gte', value: 3 }] };

  beforeAll(async () => {
    signer = await createTestSigner();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SUPABASE_JWKS)
      .useValue(signer.jwks)
      .overrideProvider(StorageService)
      .useValue(storage)
      .overrideProvider(SupabaseAdminService)
      .useValue(fakeAuthAdmin)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    png = await sharp({ create: { width: 400, height: 600, channels: 3, background: '#c0392b' } }).png().toBuffer();
  });

  afterAll(async () => {
    const v = vendorIds;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
      await tx.customer_segments.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.loyalty_card_versions.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.loyalty_cards.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.point_rules.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.vendor_images.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.rewards.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.staff_users.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.branches.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.vendors.deleteMany({ where: { id: { in: v } } });
    });
    await app.close();
  });

  it('a free trial gets everything (Chain level), and staff/me says so', async () => {
    const s = await shop({ plan_status: 'trial' });
    const me = (await s.as('get', '/staff/me').expect(200)).body;
    expect(me.vendor.plan.entitlements).toMatchObject({ tier: 'chain', trial: true, features: { insights: true, branch_comparison: true } });
    await s.as('get', `/insights?from=${today}&to=${today}`).expect(200);
    await s.as('post', '/customer-segments').send(segment).expect(201);
    expect((await s.as('get', '/broadcasts/quota').expect(200)).body).toMatchObject({ max: 3, windowHours: 24 });
    expect((await http().get(`/api/public/vendors/${s.slug}`).expect(200)).body.poweredBy).toBe(false);
  });

  it('a shop dvote runs without a plan keeps everything', async () => {
    const s = await shop({ plan_status: 'active', plan: null });
    expect((await s.as('get', '/staff/me').expect(200)).body.vendor.plan.entitlements.tier).toBe('chain');
    await s.as('get', `/insights?from=${today}&to=${today}`).expect(200);
  });

  it('Regular: locked features answer plan_required; nothing is lost, it comes back on upgrade', async () => {
    const s = await shop({ plan_status: 'active', plan: 'loyal' });
    // made on Loyal: a custom segment and a card with a custom design
    await s.as('post', '/customer-segments').send(segment).expect(201);
    await s.as('post', '/loyalty-card').send({ name: 'Gate card', spendAmount: 10, design: defaultDesign('Gate card', '#2048AC') }).expect(201);
    await setPlan(s.id, 'regular');

    const locked = async (res: request.Test, feature: string) => {
      const body = (await res.expect(403)).body;
      expect(body).toMatchObject({ code: 'plan_required', feature, requiredPlan: 'loyal' });
    };
    await locked(s.as('get', `/insights?from=${today}&to=${today}`), 'insights');
    await locked(s.as('get', `/reward-performance?from=${today}&to=${today}`), 'insights');
    await locked(s.as('get', '/insights/patterns'), 'insights');
    await locked(s.as('post', '/customer-segments').send({ ...segment, name: `More ${run}` }), 'custom_segments');
    await locked(s.as('post', '/customer-segments/preview').send({ match: 'all', rules: segment.rules }), 'custom_segments');
    await locked(s.as('get', '/customers/export'), 'customer_export');
    await locked(s.as('patch', '/broadcasts/nearby').send({ enabled: true }), 'nearby');
    await s.as('patch', '/broadcasts/nearby').send({ enabled: false }).expect(200);
    await locked(s.as('post', '/loyalty-card/versions').send({ design: defaultDesign('Gate card', '#AA2222') }), 'card_design');
    await locked(s.as('patch', '/profile').send({ pageStyle: 'compact' }), 'brand_style');
    await s.as('patch', '/profile').send({ name: `Gate ${run} renamed` }).expect(200);

    // what they made is still there: the segment still counts customers, the card keeps its look
    const customers = (await s.as('get', '/customers').expect(200)).body;
    expect(customers.customSegments.length).toBe(1);
    expect((await s.as('get', '/loyalty-card').expect(200)).body.card).not.toBeNull();
    // the basics stay open
    await s.as('get', '/summary').expect(200);
    await s.as('get', '/events').expect(200);
    expect((await http().get(`/api/public/vendors/${s.slug}`).expect(200)).body.poweredBy).toBe(true);
    expect((await s.as('get', '/staff/me').expect(200)).body.vendor.plan.entitlements).toMatchObject({ tier: 'regular', trial: false });

    await setPlan(s.id, 'loyal');
    const insights = (await s.as('get', `/insights?from=${today}&to=${today}`).expect(200)).body;
    expect(insights.branches).toEqual([]); // the by-branch comparison is Chain only
    await s.as('get', '/customers/export').expect(200);
    expect((await http().get(`/api/public/vendors/${s.slug}`).expect(200)).body.poweredBy).toBe(false);
    await setPlan(s.id, 'chain');
    expect((await s.as('get', `/insights?from=${today}&to=${today}`).expect(200)).body.branches.length).toBe(1);
  });

  it('Regular limits: 5 active rewards, 3 team members per branch, 3 menu pages; over a limit only blocks adding', async () => {
    const s = await shop({ plan_status: 'active', plan: 'regular' });
    const reward = (i: number) => s.as('post', '/rewards').send({ name: `Reward ${i}`, pointsCost: 100 + i });
    const made: string[] = [];
    for (let i = 0; i < 5; i++) made.push((await reward(i).expect(201)).body.id);
    expect((await reward(5).expect(409)).body).toMatchObject({ code: 'plan_limit', limit: 'activeRewards', max: 5, used: 5, plan: 'regular' });
    // archive one, add one, then switching the archived one back on is over the limit
    await s.as('patch', `/rewards/${made[0]}`).send({ status: 'archived' }).expect(200);
    await reward(6).expect(201);
    expect((await s.as('patch', `/rewards/${made[0]}`).send({ status: 'active' }).expect(409)).body.code).toBe('plan_limit');
    // editing an active reward is fine
    await s.as('patch', `/rewards/${made[1]}`).send({ name: 'Renamed' }).expect(200);

    const invite = (i: number) =>
      s.as('post', '/staff').send({ name: `Cashier ${i}`, email: `cashier-${i}-${run}-${s.id.slice(0, 4)}@test.dvote`, role: 'staff', branchId: s.branchId });
    for (let i = 0; i < 3; i++) await invite(i).expect(201);
    expect((await invite(3).expect(409)).body).toMatchObject({ code: 'plan_limit', limit: 'staffPerBranch', max: 3 });
    // a second open branch allows 3 more
    await prisma.branches.create({ data: { vendor_id: s.id, name: 'Second' } });
    await invite(3).expect(201);

    const upload = () => s.as('post', '/images').field('kind', 'menu').attach('file', png, 'menu.png');
    for (let i = 0; i < 3; i++) await upload().expect(201);
    expect((await upload().expect(409)).body).toMatchObject({ code: 'plan_limit', limit: 'menuImages', max: 3 });

    // moving up lifts the limits
    await setPlan(s.id, 'loyal');
    await reward(7).expect(201);
    await upload().expect(201);
  });

  it('broadcast allowance follows the plan: Regular 2 a week, Loyal 3 a day, Chain 3 a day per branch', async () => {
    const s = await shop({ plan_status: 'active', plan: 'regular' });
    expect((await s.as('get', '/broadcasts/quota').expect(200)).body).toMatchObject({ max: 2, windowHours: 168, remaining: 2 });
    await setPlan(s.id, 'loyal');
    expect((await s.as('get', '/broadcasts/quota').expect(200)).body).toMatchObject({ max: 3, windowHours: 24 });
    await setPlan(s.id, 'chain');
    await prisma.branches.create({ data: { vendor_id: s.id, name: 'Second' } });
    expect((await s.as('get', '/broadcasts/quota').expect(200)).body).toMatchObject({ max: 6, windowHours: 24, remaining: 6 });
  });
});
