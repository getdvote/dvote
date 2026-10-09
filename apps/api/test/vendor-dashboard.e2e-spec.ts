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
const ids = { vendorA: randomUUID(), vendorB: randomUUID(), branchA1: randomUUID(), branchA2: randomUUID(), branchB1: randomUUID() };

describe('Vendor dashboard API: only my vendor’s data (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  const tokens: Record<string, string> = {};
  let rewardB = '';

  const as = (who: string, method: 'get' | 'post' | 'patch' | 'delete', path: string) =>
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
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(SUPABASE_JWKS).useValue(signer.jwks).compile();
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
});
