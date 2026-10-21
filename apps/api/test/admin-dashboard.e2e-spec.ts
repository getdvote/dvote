import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { SUPABASE_JWKS } from './../src/auth/supabase-jwt.verifier';
import { PrismaService } from './../src/prisma/prisma.service';
import { StorageService } from './../src/storage/storage.service';
import { FakeStorage } from './helpers/fake-storage';
import { createTestSigner, type TestSigner } from './helpers/test-auth';

const run = randomUUID().slice(0, 8);

describe('Admin dashboard API: overview, branches, rules, rewards, staff, images, customers (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  const storage = new FakeStorage();
  const tokens: Record<string, string> = {};
  let adminId = '';
  let vendorId = '';
  let customerSub = '';
  let customerId = '';

  const http = () => request(app.getHttpServer());
  const as = (who: string, method: 'get' | 'post' | 'patch' | 'delete', path: string) =>
    http()[method](path).set('Authorization', `Bearer ${tokens[who]}`);
  const admin = (method: 'get' | 'post' | 'patch' | 'delete', path: string) => as('admin', method, path);

  beforeAll(async () => {
    signer = await createTestSigner();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SUPABASE_JWKS)
      .useValue(signer.jwks)
      .overrideProvider(StorageService)
      .useValue(storage)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const authId = randomUUID();
    adminId = (
      await prisma.platform_admins.create({
        data: { name: `Admin ${run}`, email: `admin-${run}@test.dvote`, auth_user_id: authId },
      })
    ).id;
    tokens.admin = await signer.sign(authId, { aal: 'aal2' });

    vendorId = (await prisma.vendors.create({ data: { name: `Dash ${run}` } })).id;

    customerSub = randomUUID();
    tokens.customer = await signer.sign(customerSub, {
      email: `dash-${run}@test.dvote`,
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: `Dash Customer ${run}` },
    });
    customerId = (await as('customer', 'get', '/api/app/users/me').expect(200)).body.id;
  });

  afterAll(async () => {
    await prisma.vendor_images.deleteMany({ where: { vendor_id: vendorId } });
    await prisma.staff_users.deleteMany({ where: { vendor_id: vendorId } });
    await prisma.rewards.deleteMany({ where: { vendor_id: vendorId } });
    await prisma.point_rules.deleteMany({ where: { vendor_id: vendorId } });
    await prisma.branches.deleteMany({ where: { vendor_id: vendorId } });
    await prisma.vendors.deleteMany({ where: { id: vendorId } });
    await prisma.users.deleteMany({ where: { auth_user_id: customerSub } });
    await prisma.platform_admins.deleteMany({ where: { id: adminId } });
    await app.close();
  });

  it('only platform admins: a customer token gets 403 not_admin', async () => {
    const res = await as('customer', 'get', '/api/admin/overview').expect(403);
    expect(res.body.code).toBe('not_admin');
  });

  it('me + overview', async () => {
    expect((await admin('get', '/api/admin/me').expect(200)).body).toEqual({
      id: adminId,
      name: `Admin ${run}`,
      email: `admin-${run}@test.dvote`,
    });
    const o = (await admin('get', '/api/admin/overview').expect(200)).body;
    expect(o.vendorsActive).toBeGreaterThanOrEqual(1);
    expect(o.customers).toBeGreaterThanOrEqual(1);
    expect(o.days).toHaveLength(14);
    expect(o.days[13]).toEqual(expect.objectContaining({ date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
    expect(Array.isArray(o.topVendors)).toBe(true);
  });

  it('system: database stats (sizes, tables, connections) and status checks; admins only', async () => {
    const db = (await admin('get', '/api/admin/system/database').expect(200)).body;
    expect(db.sizeBytes).toBeGreaterThan(0);
    expect(db.version).toMatch(/^PostgreSQL \d+/);
    expect(db.connections).toBeGreaterThan(0);
    expect(db.maxConnections).toBeGreaterThan(0);
    const names = (db.tables as { name: string; rows: number; sizeBytes: number }[]).map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['point_events', 'cards', 'vendors', 'users']));
    expect(Array.isArray(db.storage)).toBe(true);

    const status = (await admin('get', '/api/admin/system/status').expect(200)).body as { checks: { kind: string; up: boolean }[] };
    expect(status.checks.find((c) => c.kind === 'api')).toMatchObject({ up: true });
    expect(status.checks.find((c) => c.kind === 'database')).toMatchObject({ up: true });

    await request(app.getHttpServer()).get('/api/admin/system/database').set('Authorization', `Bearer ${tokens.customer}`).expect(403);
  }, 20_000);

  it('branches: add, edit, close; unknown vendor/branch → 404', async () => {
    const created = await admin('post', `/api/admin/vendors/${vendorId}/branches`)
      .send({ name: 'Smouha', address: 'Smouha, Alexandria', lat: 31.2156, lng: 29.9553 })
      .expect(201);
    expect(created.body).toMatchObject({ vendorId, name: 'Smouha', lat: 31.2156, timezone: 'Africa/Cairo', status: 'active' });

    const edited = await admin('patch', `/api/admin/branches/${created.body.id}`)
      .send({ address: null, status: 'closed' })
      .expect(200);
    expect(edited.body).toMatchObject({ address: null, status: 'closed' });

    await admin('post', `/api/admin/vendors/${vendorId}/branches`).send({ name: 'Gleem' }).expect(201);
    const list = (await admin('get', `/api/admin/vendors/${vendorId}/branches`).expect(200)).body;
    expect(list.map((b: { name: string }) => b.name)).toEqual(['Gleem', 'Smouha']); // open first

    expect((await admin('get', `/api/admin/vendors/${randomUUID()}/branches`).expect(404)).body.code).toBe('vendor_not_found');
    expect((await admin('patch', `/api/admin/branches/${randomUUID()}`).send({ name: 'x' }).expect(404)).body.code).toBe(
      'branch_not_found',
    );
    await admin('post', `/api/admin/vendors/${vendorId}/branches`).send({ name: '' }).expect(400);
  });

  it('point rules: each publish is a new active version; deactivate stops earning', async () => {
    const v1 = await admin('post', `/api/admin/vendors/${vendorId}/point-rules`).send({ spendAmount: 10, pointsPerSpend: 1 }).expect(201);
    expect(v1.body).toMatchObject({ version: 1, spendAmount: '10.00', pointsPerSpend: 1, minPurchase: '0.00', isActive: true });

    const v2 = await admin('post', `/api/admin/vendors/${vendorId}/point-rules`)
      .send({ spendAmount: 5.5, pointsPerSpend: 2, minPurchase: 20, maxPointsPerPurchase: 300 })
      .expect(201);
    expect(v2.body).toMatchObject({ version: 2, spendAmount: '5.50', minPurchase: '20.00', maxPointsPerPurchase: 300, isActive: true });

    const list = (await admin('get', `/api/admin/vendors/${vendorId}/point-rules`).expect(200)).body;
    expect(list.map((r: { version: number; isActive: boolean }) => [r.version, r.isActive])).toEqual([
      [2, true],
      [1, false],
    ]);

    await admin('delete', `/api/admin/vendors/${vendorId}/point-rules/active`).expect(204);
    expect(await prisma.point_rules.count({ where: { vendor_id: vendorId, is_active: true } })).toBe(0);

    await admin('post', `/api/admin/vendors/${vendorId}/point-rules`).send({ spendAmount: 0, pointsPerSpend: 1 }).expect(400);
    await admin('post', `/api/admin/vendors/${vendorId}/point-rules`).send({ spendAmount: 10, pointsPerSpend: 1.5 }).expect(400);
  });

  it('rewards: create with Arabic, edit price, archive; archived listed last', async () => {
    const coffee = await admin('post', `/api/admin/vendors/${vendorId}/rewards`)
      .send({ name: 'Free coffee', nameAr: 'قهوة مجانية', description: 'Any size', pointsCost: 300 })
      .expect(201);
    expect(coffee.body).toMatchObject({ name: 'Free coffee', nameAr: 'قهوة مجانية', descriptionAr: null, pointsCost: 300, status: 'active' });

    const cake = await admin('post', `/api/admin/vendors/${vendorId}/rewards`).send({ name: 'Cake', pointsCost: 500 }).expect(201);
    expect(cake.body.sortOrder).toBeGreaterThan(coffee.body.sortOrder);

    const edited = await admin('patch', `/api/admin/rewards/${coffee.body.id}`)
      .send({ pointsCost: 350, nameAr: '', descriptionAr: 'أي حجم' })
      .expect(200);
    expect(edited.body).toMatchObject({ pointsCost: 350, nameAr: null, descriptionAr: 'أي حجم' });

    await admin('patch', `/api/admin/rewards/${coffee.body.id}`).send({ status: 'archived' }).expect(200);
    const list = (await admin('get', `/api/admin/vendors/${vendorId}/rewards`).expect(200)).body;
    expect(list.map((r: { name: string; status: string }) => `${r.name}:${r.status}`)).toEqual(['Cake:active', 'Free coffee:archived']);

    await admin('post', `/api/admin/vendors/${vendorId}/rewards`).send({ name: 'Free', pointsCost: 0 }).expect(400);
    expect((await admin('patch', `/api/admin/rewards/${randomUUID()}`).send({ name: 'x' }).expect(404)).body.code).toBe('reward_not_found');
  });

  it('staff: list a vendor’s staff, disable and re-enable', async () => {
    const s = await prisma.staff_users.create({
      data: { vendor_id: vendorId, name: 'Sara', email: `sara-${run}@test.dvote`, role: 'vendor_admin', auth_user_id: randomUUID() },
    });
    const list = (await admin('get', `/api/admin/vendors/${vendorId}/staff`).expect(200)).body;
    expect(list).toEqual([expect.objectContaining({ id: s.id, role: 'vendor_admin', status: 'active' })]);

    expect((await admin('patch', `/api/admin/staff/${s.id}`).send({ status: 'disabled' }).expect(200)).body.status).toBe('disabled');
    expect((await admin('patch', `/api/admin/staff/${s.id}`).send({ status: 'active', name: 'Sara H.' }).expect(200)).body).toMatchObject({
      status: 'active',
      name: 'Sara H.',
    });
    await admin('patch', `/api/admin/staff/${s.id}`).send({ role: 'staff' }).expect(400); // role changes stay with the vendor
  });

  it('images: an admin adds and deletes a vendor’s menu page', async () => {
    const png = await sharp({ create: { width: 600, height: 900, channels: 3, background: '#333' } }).png().toBuffer();
    const page = await admin('post', `/api/admin/vendors/${vendorId}/images`).field('kind', 'menu').attach('file', png, 'menu.png').expect(201);
    expect(page.body).toMatchObject({ kind: 'menu', branchId: null });
    expect(storage.list('vendors', `${vendorId}/menu/`)).toHaveLength(1);

    expect((await admin('get', `/api/admin/vendors/${vendorId}/images`).expect(200)).body).toHaveLength(1);
    await admin('delete', `/api/admin/vendors/${vendorId}/images/${page.body.id}`).expect(204);
    expect(storage.list('vendors', `${vendorId}/menu/`)).toHaveLength(0);
    await admin('get', `/api/admin/vendors/${randomUUID()}/images`).expect(404);
  });

  it('customers: search, details, block (then the app refuses them), unblock', async () => {
    const found = (await admin('get', `/api/admin/users?search=dash customer ${run}`).expect(200)).body;
    expect(found).toMatchObject({ total: 1, page: 1, pageSize: 20 });
    expect(found.items[0]).toMatchObject({ id: customerId, email: `dash-${run}@test.dvote`, status: 'active', cardsCount: 0, pointsBalance: 0 });

    const detail = (await admin('get', `/api/admin/users/${customerId}`).expect(200)).body;
    expect(detail).toMatchObject({ id: customerId, cards: [], events: [] });

    await admin('patch', `/api/admin/users/${customerId}`).send({ status: 'blocked' }).expect(200);
    expect((await as('customer', 'get', '/api/app/users/me').expect(403)).body.code).toBe('user_blocked');
    const blocked = (await admin('get', `/api/admin/users?status=blocked&search=${run}`).expect(200)).body;
    expect(blocked.items.map((u: { id: string }) => u.id)).toContain(customerId);

    await admin('patch', `/api/admin/users/${customerId}`).send({ status: 'active' }).expect(200);
    await as('customer', 'get', '/api/app/users/me').expect(200);

    await admin('patch', `/api/admin/users/${customerId}`).send({ status: 'deleted' }).expect(400);
    expect((await admin('get', `/api/admin/users/${randomUUID()}`).expect(404)).body.code).toBe('user_not_found');
  });
});
