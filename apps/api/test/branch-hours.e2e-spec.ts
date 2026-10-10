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
  branchA1: randomUUID(),
  branchA2: randomUUID(),
  branchB1: randomUUID(),
};
const slot = (day: number, opensAt: string, closesAt: string) => ({
  day,
  opensAt,
  closesAt,
});

describe('Branch weekly hours + temporarily closed (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  const tokens: Record<string, string> = {};
  const customerSubs: string[] = [];

  const as = (
    who: string,
    method: 'get' | 'post' | 'patch' | 'put' | 'delete',
    path: string,
  ) =>
    request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${tokens[who]}`);

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
        { id: ids.vendorA, name: `Hours A ${run}` },
        { id: ids.vendorB, name: `Hours B ${run}` },
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
    await seedStaff('staffA1', ids.vendorA, ids.branchA1, 'staff');
    const sub = randomUUID();
    customerSubs.push(sub);
    tokens.mona = await signer.sign(sub, {
      email: `mona-${run}@test.dvote`,
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: 'Mona' },
    });
    await as('mona', 'get', '/api/app/users/me').expect(200);
  });

  afterAll(async () => {
    const v = [ids.vendorA, ids.vendorB];
    await prisma.staff_users.deleteMany({ where: { vendor_id: { in: v } } });
    await prisma.branches.deleteMany({ where: { vendor_id: { in: v } } });
    await prisma.vendors.deleteMany({ where: { id: { in: v } } });
    await prisma.users.deleteMany({
      where: { auth_user_id: { in: customerSubs } },
    });
    await app.close();
  });

  const patch = (body: object, who = 'adminA', id = ids.branchA1) =>
    as(who, 'patch', `/api/vendor/branches/${id}`).send(body);

  it('split shifts per day, sorted; legacy pair only when every day is the same single slot', async () => {
    const week = [
      slot(5, '17:00', '01:00'),
      slot(5, '09:00', '13:00'),
      slot(6, '09:00', '23:00'),
    ]; // Fri split, Sat; other days closed
    const res = (await patch({ hours: week }).expect(200)).body;
    expect(res.hours).toEqual([
      slot(5, '09:00', '13:00'),
      slot(5, '17:00', '01:00'),
      slot(6, '09:00', '23:00'),
    ]);
    expect(res).toMatchObject({ opensAt: null, closesAt: null });

    const same = Array.from({ length: 7 }, (_, d) => slot(d, '08:00', '22:00'));
    expect((await patch({ hours: same }).expect(200)).body).toMatchObject({
      opensAt: '08:00',
      closesAt: '22:00',
    });

    // An old client's single pair becomes every day.
    const legacy = (
      await patch({ opensAt: '10:00', closesAt: '02:00' }).expect(200)
    ).body;
    expect(legacy.hours).toHaveLength(7);
    expect(legacy.hours[3]).toEqual(slot(3, '10:00', '02:00'));

    expect((await patch({ hours: [] }).expect(200)).body).toMatchObject({
      hours: null,
      opensAt: null,
      closesAt: null,
    });
  });

  it('rejects overlaps, a non-last slot past midnight, too many slots, bad values; managers can’t edit hours', async () => {
    expect(
      (
        await patch({
          hours: [slot(1, '09:00', '14:00'), slot(1, '13:00', '18:00')],
        }).expect(400)
      ).body.code,
    ).toBe('hours_overlap');
    expect(
      (
        await patch({
          hours: [slot(1, '20:00', '02:00'), slot(1, '22:00', '23:00')],
        }).expect(400)
      ).body.code,
    ).toBe('hours_overlap');
    expect(
      (
        await patch({
          hours: [
            slot(1, '08:00', '09:00'),
            slot(1, '10:00', '11:00'),
            slot(1, '12:00', '13:00'),
            slot(1, '14:00', '15:00'),
          ],
        }).expect(400)
      ).body.code,
    ).toBe('too_many_slots');
    expect(
      (await patch({ hours: [slot(1, '09:00', '09:00')] }).expect(400)).body
        .code,
    ).toBe('hours_invalid');
    await patch({ hours: [slot(7, '09:00', '10:00')] }).expect(400);
    await patch({ hours: [slot(1, '9:00', '10:00')] }).expect(400);
    await patch({ hours: [slot(1, '09:00', '10:00')] }, 'managerA1').expect(
      403,
    );
  });

  it('temporarily closed: manager own branch only, ends by itself, shown on the shop page', async () => {
    const until = new Date(Date.now() + 2 * 3_600_000).toISOString();
    expect(
      (
        await as(
          'managerA1',
          'put',
          `/api/vendor/branches/${ids.branchA1}/pause`,
        )
          .send({ until })
          .expect(200)
      ).body.pausedUntil,
    ).toBe(until);
    expect(
      (
        await as(
          'managerA1',
          'put',
          `/api/vendor/branches/${ids.branchA2}/pause`,
        )
          .send({ until })
          .expect(403)
      ).body.code,
    ).toBe('forbidden_branch');
    expect(
      (
        await as('adminA', 'put', `/api/vendor/branches/${ids.branchB1}/pause`)
          .send({ until })
          .expect(404)
      ).body.code,
    ).toBe('branch_not_found');
    await as('staffA1', 'put', `/api/vendor/branches/${ids.branchA1}/pause`)
      .send({ until })
      .expect(403);
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(
      (
        await as('adminA', 'put', `/api/vendor/branches/${ids.branchA2}/pause`)
          .send({ until: past })
          .expect(400)
      ).body.code,
    ).toBe('until_in_past');
    const far = new Date(Date.now() + 15 * 86_400_000).toISOString();
    expect(
      (
        await as('adminA', 'put', `/api/vendor/branches/${ids.branchA2}/pause`)
          .send({ until: far })
          .expect(400)
      ).body.code,
    ).toBe('until_too_far');

    const page = (
      await as('mona', 'get', `/api/app/vendors/${ids.vendorA}`).expect(200)
    ).body as {
      branches: { name: string; pausedUntil: string | null; hours: unknown }[];
    };
    expect(page.branches.find((b) => b.name === 'A1')!.pausedUntil).toBe(until);
    expect(page.branches.find((b) => b.name === 'A2')!.pausedUntil).toBeNull();

    // Open again now; and a pause whose time passed no longer shows.
    expect(
      (
        await as(
          'adminA',
          'delete',
          `/api/vendor/branches/${ids.branchA1}/pause`,
        ).expect(200)
      ).body.pausedUntil,
    ).toBeNull();
    await prisma.branches.update({
      where: { id: ids.branchA2 },
      data: { paused_until: new Date(Date.now() - 1000) },
    });
    const list = (await as('adminA', 'get', '/api/vendor/branches').expect(200))
      .body as { name: string; pausedUntil: string | null }[];
    expect(list.find((b) => b.name === 'A2')!.pausedUntil).toBeNull();
  });
});
