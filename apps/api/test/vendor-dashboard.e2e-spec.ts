import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { SUPABASE_JWKS } from './../src/auth/supabase-jwt.verifier';
import type { staff_role } from './../src/generated/prisma/client.js';
import { PrismaService } from './../src/prisma/prisma.service';
import { BUCKETS, StorageService } from './../src/storage/storage.service';
import { FakeStorage } from './helpers/fake-storage';
import { createTestSigner, type TestSigner } from './helpers/test-auth';

const run = randomUUID().slice(0, 8);
const ids = { vendorA: randomUUID(), vendorB: randomUUID(), branchA1: randomUUID(), branchA2: randomUUID(), branchB1: randomUUID() };

describe('Vendor dashboard API: only my vendor’s data (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  const tokens: Record<string, string> = {};
  let rewardB = '';
  const storage = new FakeStorage();

  const as = (who: string, method: 'get' | 'post' | 'patch' | 'put' | 'delete', path: string) =>
    request(app.getHttpServer())[method](path).set('Authorization', `Bearer ${tokens[who]}`);

  async function seedStaff(key: string, vendorId: string, branchId: string | null, role: staff_role) {
    const authId = randomUUID();
    await prisma.staff_users.create({
      data: { vendor_id: vendorId, branch_id: branchId, name: key, email: `${key}-${run}@test.dvote`, role, auth_user_id: authId },
    });
    tokens[key] = await signer.sign(authId);
  }

  beforeAll(async () => {
    signer = await createTestSigner();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(SUPABASE_JWKS)
      .useValue(signer.jwks)
      .overrideProvider(StorageService)
      .useValue(storage)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.vendors.createMany({ data: [{ id: ids.vendorA, name: `Starbucks ${run}` }, { id: ids.vendorB, name: `Costa ${run}` }] });
    await prisma.branches.createMany({
      data: [
        { id: ids.branchA1, vendor_id: ids.vendorA, name: 'A1' },
        { id: ids.branchA2, vendor_id: ids.vendorA, name: 'A2' },
        { id: ids.branchB1, vendor_id: ids.vendorB, name: 'B1' },
      ],
    });
    rewardB = (await prisma.rewards.create({ data: { vendor_id: ids.vendorB, name: 'B secret reward', points_cost: 100 } })).id;
    await seedStaff('adminA', ids.vendorA, null, 'vendor_admin');
    await seedStaff('managerA1', ids.vendorA, ids.branchA1, 'branch_manager');
    await seedStaff('staffA1', ids.vendorA, ids.branchA1, 'staff');
    await seedStaff('adminB', ids.vendorB, null, 'vendor_admin');
  });

  afterAll(async () => {
    const v = [ids.vendorA, ids.vendorB];
    await prisma.rewards.deleteMany({ where: { vendor_id: { in: v } } });
    await prisma.point_rules.deleteMany({ where: { vendor_id: { in: v } } });
    await prisma.staff_users.deleteMany({ where: { vendor_id: { in: v } } });
    await prisma.branches.deleteMany({ where: { vendor_id: { in: v } } });
    await prisma.vendors.deleteMany({ where: { id: { in: v } } });
    await app.close();
  });

  it('branches: only my vendor’s; another vendor’s branch is "not found"', async () => {
    const list = (await as('adminA', 'get', '/api/vendor/branches').expect(200)).body as { name: string }[];
    expect(list.map((b) => b.name).sort()).toEqual(['A1', 'A2']);

    const created = await as('adminA', 'post', '/api/vendor/branches').send({ name: 'A3' }).expect(201);
    expect(created.body.vendorId).toBe(ids.vendorA);
    // A map location is both coordinates or none.
    expect((await as('adminA', 'post', '/api/vendor/branches').send({ name: 'Half', lat: 31.2 }).expect(400)).body.code).toBe('location_incomplete');
    await as('adminA', 'post', '/api/vendor/branches').send({ name: 'Far', lat: 95, lng: 10 }).expect(400);
    await as('adminA', 'patch', `/api/vendor/branches/${created.body.id}`).send({ lat: 31.2, lng: 29.9 }).expect(200);
    expect((await as('adminA', 'patch', `/api/vendor/branches/${created.body.id}`).send({ lng: null }).expect(400)).body.code).toBe('location_incomplete');
    // Opening hours: optional, both times or none, "HH:MM", may run past midnight.
    expect(created.body).toMatchObject({ opensAt: null, closesAt: null });
    const late = await as('adminA', 'patch', `/api/vendor/branches/${created.body.id}`).send({ opensAt: '18:00', closesAt: '02:00' }).expect(200);
    expect(late.body).toMatchObject({ opensAt: '18:00', closesAt: '02:00' });
    expect((await as('adminA', 'patch', `/api/vendor/branches/${created.body.id}`).send({ closesAt: null }).expect(400)).body.code).toBe('hours_incomplete');
    expect((await as('adminA', 'patch', `/api/vendor/branches/${created.body.id}`).send({ closesAt: '18:00' }).expect(400)).body.code).toBe('hours_invalid');
    await as('adminA', 'patch', `/api/vendor/branches/${created.body.id}`).send({ opensAt: '9:00', closesAt: '23:00' }).expect(400);
    await as('adminA', 'patch', `/api/vendor/branches/${created.body.id}`).send({ opensAt: null, closesAt: null }).expect(200);
    // City: one of the listed Egyptian cities, or null.
    expect((await as('adminA', 'patch', `/api/vendor/branches/${created.body.id}`).send({ city: 'alexandria' }).expect(200)).body.city).toBe('alexandria');
    await as('adminA', 'patch', `/api/vendor/branches/${created.body.id}`).send({ city: 'atlantis' }).expect(400);
    expect((await as('adminA', 'patch', `/api/vendor/branches/${created.body.id}`).send({ city: null }).expect(200)).body.city).toBeNull();

    expect((await as('adminA', 'patch', `/api/vendor/branches/${ids.branchB1}`).send({ name: 'hacked' }).expect(404)).body.code).toBe('branch_not_found');
    expect((await prisma.branches.findUniqueOrThrow({ where: { id: ids.branchB1 } })).name).toBe('B1');

    await as('managerA1', 'get', '/api/vendor/branches').expect(200);
    expect((await as('managerA1', 'post', '/api/vendor/branches').send({ name: 'x' }).expect(403)).body.code).toBe('forbidden_role');
    await as('staffA1', 'get', '/api/vendor/branches').expect(403);
  });

  it('point rules: my vendor only, recorded with who published it', async () => {
    const r = await as('adminA', 'post', '/api/vendor/point-rules').send({ spendAmount: 10, pointsPerSpend: 1 }).expect(201);
    expect(r.body).toMatchObject({ version: 1, isActive: true });
    expect((await prisma.point_rules.findUniqueOrThrow({ where: { id: r.body.id } })).vendor_id).toBe(ids.vendorA);
    expect(await prisma.point_rules.count({ where: { vendor_id: ids.vendorB } })).toBe(0);

    expect((await as('adminB', 'get', '/api/vendor/point-rules').expect(200)).body).toEqual([]);
    expect((await as('managerA1', 'get', '/api/vendor/point-rules').expect(200)).body).toHaveLength(1);
    await as('managerA1', 'post', '/api/vendor/point-rules').send({ spendAmount: 5, pointsPerSpend: 1 }).expect(403);
    await as('managerA1', 'delete', '/api/vendor/point-rules/active').expect(403);
    await as('adminA', 'delete', '/api/vendor/point-rules/active').expect(204);
  });

  it('rewards: my vendor only; another vendor’s reward is "not found" and untouched', async () => {
    await as('adminA', 'post', '/api/vendor/rewards').send({ name: 'A coffee', nameAr: 'قهوة', pointsCost: 300 }).expect(201);
    const mine = (await as('adminA', 'get', '/api/vendor/rewards').expect(200)).body as { name: string }[];
    expect(mine.map((r) => r.name)).toEqual(['A coffee']); // never "B secret reward"

    expect((await as('adminA', 'patch', `/api/vendor/rewards/${rewardB}`).send({ pointsCost: 1 }).expect(404)).body.code).toBe('reward_not_found');
    expect((await prisma.rewards.findUniqueOrThrow({ where: { id: rewardB } })).points_cost).toBe(100);
  });

  it('summary: counts only (no customer data); a manager sees only their branch', async () => {
    const s = (await as('adminA', 'get', '/api/vendor/summary').expect(200)).body;
    expect(s).toMatchObject({ collectsToday: 0, customers: 0, pointsOutstanding: 0 });
    expect(s.days).toHaveLength(14);
    expect(s.branches.map((b: { name: string }) => b.name).sort()).toEqual(['A1', 'A2', 'A3']);
    expect(JSON.stringify(s)).not.toMatch(/email|phone|"name":"(?!A\d)/);

    const m = (await as('managerA1', 'get', '/api/vendor/summary').expect(200)).body;
    expect(m.branches.map((b: { name: string }) => b.name)).toEqual(['A1']);
    await as('staffA1', 'get', '/api/vendor/summary').expect(403);
  });

  it('branding: category + card design (validated), banner upload / replace / remove', async () => {
    const p = (await as('adminA', 'patch', '/api/vendor/profile').send({ category: 'cafe_restaurant', cardDesign: 7 }).expect(200)).body;
    expect(p).toMatchObject({ category: 'cafe_restaurant', cardDesign: 7, bannerUrl: null });
    await as('adminA', 'patch', '/api/vendor/profile').send({ category: 'pizza' }).expect(400);
    await as('adminA', 'patch', '/api/vendor/profile').send({ cardDesign: 11 }).expect(400);
    await as('adminA', 'patch', '/api/vendor/profile').send({ cardDesign: 0 }).expect(400);
    await as('managerA1', 'patch', '/api/vendor/profile').send({ cardDesign: 2 }).expect(403);
    expect((await as('adminA', 'patch', '/api/vendor/profile').send({ category: null, cardDesign: null }).expect(200)).body).toMatchObject({
      category: null,
      cardDesign: null,
    });

    const png = await sharp({ create: { width: 2000, height: 600, channels: 3, background: '#2E9E6B' } }).png().toBuffer();
    const putBanner = () => as('adminA', 'put', '/api/vendor/profile/banner').attach('file', png, 'banner.png');
    const first = (await putBanner().expect(200)).body as { bannerUrl: string };
    const firstPath = (await prisma.vendors.findUniqueOrThrow({ where: { id: ids.vendorA } })).banner_path!;
    expect(firstPath.startsWith(`${ids.vendorA}/banner/`)).toBe(true);
    expect(first.bannerUrl).toContain(firstPath);
    const { width, height } = await sharp(storage.get(BUCKETS.vendors, firstPath)!.data).metadata();
    expect([width, height]).toEqual([1600, 800]); // wide 2:1 banner

    await putBanner().expect(200);
    expect(storage.has(BUCKETS.vendors, firstPath)).toBe(false);
    expect(storage.list(BUCKETS.vendors, `${ids.vendorA}/banner/`)).toHaveLength(1);
    // tiny file: the 403 is sent before the body is read, and a big upload would hit ECONNRESET
    const tiny = await sharp({ create: { width: 4, height: 2, channels: 3, background: '#000' } }).png().toBuffer();
    await as('managerA1', 'put', '/api/vendor/profile/banner').attach('file', tiny, 'b.png').expect(403);

    expect((await as('adminA', 'delete', '/api/vendor/profile/banner').expect(200)).body.bannerUrl).toBeNull();
    expect(storage.list(BUCKETS.vendors, `${ids.vendorA}/banner/`)).toHaveLength(0);
  });

  it('reward photo: upload, replace (old file deleted), remove; never on another vendor’s reward', async () => {
    const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#6155F5' } }).png().toBuffer();
    const put = (who: string, id: string) => as(who, 'put', `/api/vendor/rewards/${id}/image`).attach('file', png, 'cake.png');
    const reward = (await as('adminA', 'post', '/api/vendor/rewards').send({ name: 'Cake', pointsCost: 500 }).expect(201)).body as {
      id: string;
      imageUrl: string | null;
    };
    expect(reward.imageUrl).toBeNull();

    const first = (await put('adminA', reward.id).expect(200)).body as { imageUrl: string };
    const firstPath = (await prisma.rewards.findUniqueOrThrow({ where: { id: reward.id } })).image_path!;
    expect(firstPath.startsWith(`${ids.vendorA}/rewards/`)).toBe(true);
    expect(first.imageUrl).toContain(firstPath);
    expect(storage.has(BUCKETS.vendors, firstPath)).toBe(true);

    await put('adminA', reward.id).expect(200);
    expect(storage.has(BUCKETS.vendors, firstPath)).toBe(false);
    expect(storage.list(BUCKETS.vendors, `${ids.vendorA}/rewards/`)).toHaveLength(1);

    await put('managerA1', reward.id).expect(403);
    expect((await put('adminA', rewardB).expect(404)).body.code).toBe('reward_not_found');

    const removed = (await as('adminA', 'delete', `/api/vendor/rewards/${reward.id}/image`).expect(200)).body as { imageUrl: string | null };
    expect(removed.imageUrl).toBeNull();
    expect(storage.list(BUCKETS.vendors, `${ids.vendorA}/rewards/`)).toHaveLength(0);
  });
});
