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

interface SoldOut {
  rewardId: string;
  branchId: string;
  branchName: string;
  until: string | null;
}

describe('Reward sold out per branch (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  const tokens: Record<string, string> = {};
  const customerSubs: string[] = [];
  const rewards = { cake: '', coffee: '', other: '' };

  const as = (
    who: string,
    method: 'get' | 'post' | 'put' | 'delete',
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

  const soldOut = async (who = 'adminA') =>
    (await as(who, 'get', '/api/vendor/rewards/sold-out').expect(200))
      .body as SoldOut[];
  const inHours = (h: number) =>
    new Date(Date.now() + h * 3_600_000).toISOString();

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
        { id: ids.vendorA, name: `Sold A ${run}` },
        { id: ids.vendorB, name: `Sold B ${run}` },
      ],
    });
    await prisma.branches.createMany({
      data: [
        { id: ids.branchA1, vendor_id: ids.vendorA, name: 'A1' },
        { id: ids.branchA2, vendor_id: ids.vendorA, name: 'A2' },
        { id: ids.branchB1, vendor_id: ids.vendorB, name: 'B1' },
      ],
    });
    await prisma.point_rules.create({
      data: {
        vendor_id: ids.vendorA,
        version: 1,
        spend_amount: 10,
        points_per_spend: 1,
      },
    });
    rewards.cake = (
      await prisma.rewards.create({
        data: { vendor_id: ids.vendorA, name: 'Cheesecake', points_cost: 10 },
      })
    ).id;
    rewards.coffee = (
      await prisma.rewards.create({
        data: { vendor_id: ids.vendorA, name: 'Coffee', points_cost: 10 },
      })
    ).id;
    rewards.other = (
      await prisma.rewards.create({
        data: { vendor_id: ids.vendorB, name: 'B reward', points_cost: 10 },
      })
    ).id;
    await seedStaff('adminA', ids.vendorA, null, 'vendor_admin');
    await seedStaff('managerA1', ids.vendorA, ids.branchA1, 'branch_manager');
    await seedStaff('staffA1', ids.vendorA, ids.branchA1, 'staff');
    await seedStaff('staffA2', ids.vendorA, ids.branchA2, 'staff');
    await seedStaff('adminB', ids.vendorB, null, 'vendor_admin');

    const sub = randomUUID();
    customerSubs.push(sub);
    tokens.mona = await signer.sign(sub, {
      email: `mona-${run}@test.dvote`,
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: 'Mona Ali' },
    });
    await as('mona', 'get', '/api/app/users/me').expect(200);
    // 100 points at A, earned the normal way.
    const { code } = (
      await as('mona', 'post', '/api/app/qr-codes')
        .send({ purpose: 'collect' })
        .expect(201)
    ).body as { code: string };
    await as('staffA1', 'post', '/api/vendor/scans/collect')
      .send({ code, amount: 1000, idempotencyKey: randomUUID() })
      .expect(200);
  });

  afterAll(async () => {
    const v = [ids.vendorA, ids.vendorB];
    const users = await prisma.users.findMany({
      where: { auth_user_id: { in: customerSubs } },
      select: { id: true },
    });
    await prisma.$transaction(async (tx) => {
      // point_events is append-only (trigger): bypass triggers for test cleanup only.
      await tx.$executeRawUnsafe(
        'SET LOCAL session_replication_role = replica',
      );
      await tx.reward_sold_outs.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.redemptions.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.point_events.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.cards.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.qr_codes.deleteMany({
        where: { user_id: { in: users.map((u) => u.id) } },
      });
      await tx.rewards.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.point_rules.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.staff_users.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.branches.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.vendors.deleteMany({ where: { id: { in: v } } });
      await tx.users.deleteMany({
        where: { id: { in: users.map((u) => u.id) } },
      });
    });
    await app.close();
  });

  it('branch manager: marks their own branch only; staff role refused', async () => {
    const until = inHours(4);
    const res = (
      await as(
        'managerA1',
        'put',
        `/api/vendor/rewards/${rewards.cake}/sold-out`,
      )
        .send({ until })
        .expect(200)
    ).body as SoldOut[];
    expect(res).toEqual([
      {
        rewardId: rewards.cake,
        branchId: ids.branchA1,
        branchName: 'A1',
        until,
      },
    ]);
    expect(
      (
        await as(
          'managerA1',
          'put',
          `/api/vendor/rewards/${rewards.cake}/sold-out`,
        )
          .send({ branchId: ids.branchA2, until: null })
          .expect(403)
      ).body.code,
    ).toBe('forbidden_branch');
    await as('staffA1', 'put', `/api/vendor/rewards/${rewards.cake}/sold-out`)
      .send({ until: null })
      .expect(403);
    await as('staffA1', 'get', '/api/vendor/rewards/sold-out').expect(403);
  });

  it('staff at the sold-out branch can’t give it; another branch can', async () => {
    const qr = async () =>
      (
        (
          await as('mona', 'post', '/api/app/qr-codes')
            .send({ purpose: 'redeem', rewardId: rewards.cake })
            .expect(201)
        ).body as { code: string }
      ).code;

    // Customers still get a QR (another branch may have it) and see where it's sold out.
    const page = (
      await as('mona', 'get', `/api/app/vendors/${ids.vendorA}`).expect(200)
    ).body as {
      rewards: {
        id: string;
        soldOutAt: { branchName: string; until: string | null }[];
      }[];
    };
    expect(page.rewards.find((r) => r.id === rewards.cake)!.soldOutAt).toEqual([
      expect.objectContaining({ branchName: 'A1' }),
    ]);
    expect(
      page.rewards.find((r) => r.id === rewards.coffee)!.soldOutAt,
    ).toEqual([]);

    const code = await qr();
    const preview = (
      await as('staffA1', 'post', '/api/vendor/scans/preview')
        .send({ code })
        .expect(200)
    ).body;
    expect(preview).toMatchObject({
      usable: false,
      reason: 'reward_sold_out',
      redeem: null,
    });
    expect(
      (
        await as('staffA1', 'post', '/api/vendor/scans/redeem')
          .send({ code, idempotencyKey: randomUUID() })
          .expect(409)
      ).body.code,
    ).toBe('reward_sold_out');
    // A vendor admin confirming for A1 is refused too; nothing was taken.
    expect(
      (
        await as('adminA', 'post', '/api/vendor/scans/redeem')
          .send({ code, branchId: ids.branchA1, idempotencyKey: randomUUID() })
          .expect(409)
      ).body.code,
    ).toBe('reward_sold_out');
    expect(
      await prisma.redemptions.count({ where: { vendor_id: ids.vendorA } }),
    ).toBe(0);

    // The same QR still works at A2.
    expect(
      (
        await as('staffA2', 'post', '/api/vendor/scans/preview')
          .send({ code })
          .expect(200)
      ).body.usable,
    ).toBe(true);
    await as('staffA2', 'post', '/api/vendor/scans/redeem')
      .send({ code, idempotencyKey: randomUUID() })
      .expect(200);
  });

  it('vendor admin: all branches at once, one branch, back on sale; rows kept', async () => {
    await as('adminA', 'put', `/api/vendor/rewards/${rewards.coffee}/sold-out`)
      .send({ until: null })
      .expect(200);
    expect(
      (await soldOut())
        .filter((s) => s.rewardId === rewards.coffee)
        .map((s) => [s.branchName, s.until]),
    ).toEqual([
      ['A1', null],
      ['A2', null],
    ]);
    // Sold out at every branch: the app shows it and won't make a redeem QR.
    const page = (
      await as('mona', 'get', `/api/app/vendors/${ids.vendorA}`).expect(200)
    ).body as {
      rewards: { id: string; soldOutEverywhere: boolean }[];
    };
    expect(
      page.rewards.find((r) => r.id === rewards.coffee)!.soldOutEverywhere,
    ).toBe(true);
    expect(
      page.rewards.find((r) => r.id === rewards.cake)!.soldOutEverywhere,
    ).toBe(false);
    expect(
      (
        await as('mona', 'post', '/api/app/qr-codes')
          .send({ purpose: 'redeem', rewardId: rewards.coffee })
          .expect(409)
      ).body.code,
    ).toBe('reward_sold_out');
    // Managers see every branch's sold-outs (read-only for other branches).
    expect((await soldOut('managerA1')).length).toBe(3);

    await as(
      'adminA',
      'delete',
      `/api/vendor/rewards/${rewards.coffee}/sold-out?branchId=${ids.branchA2}`,
    ).expect(200);
    expect(
      (await soldOut())
        .filter((s) => s.rewardId === rewards.coffee)
        .map((s) => s.branchName),
    ).toEqual(['A1']);
    await as(
      'adminA',
      'delete',
      `/api/vendor/rewards/${rewards.coffee}/sold-out`,
    ).expect(200);
    expect(
      (await soldOut()).filter((s) => s.rewardId === rewards.coffee),
    ).toEqual([]);
    // Back on sale ends the row instead of deleting it.
    expect(
      await prisma.reward_sold_outs.count({
        where: { reward_id: rewards.coffee },
      }),
    ).toBe(2);
  });

  it('a timed sold-out ends by itself', async () => {
    await prisma.reward_sold_outs.updateMany({
      where: { reward_id: rewards.cake },
      data: { sold_out_until: new Date(Date.now() - 1000) },
    });
    expect(
      (await soldOut()).filter((s) => s.rewardId === rewards.cake),
    ).toEqual([]);
  });

  it('rules: other vendors’ rewards and branches, bad times', async () => {
    expect(
      (
        await as(
          'adminA',
          'put',
          `/api/vendor/rewards/${rewards.other}/sold-out`,
        )
          .send({ until: null })
          .expect(404)
      ).body.code,
    ).toBe('reward_not_found');
    expect(
      (
        await as(
          'adminA',
          'put',
          `/api/vendor/rewards/${rewards.cake}/sold-out`,
        )
          .send({ branchId: ids.branchB1, until: null })
          .expect(400)
      ).body.code,
    ).toBe('invalid_branch');
    expect(
      (
        await as(
          'adminA',
          'put',
          `/api/vendor/rewards/${rewards.cake}/sold-out`,
        )
          .send({ until: inHours(-1) })
          .expect(400)
      ).body.code,
    ).toBe('until_in_past');
    expect(
      (
        await as(
          'adminA',
          'put',
          `/api/vendor/rewards/${rewards.cake}/sold-out`,
        )
          .send({ until: inHours(24 * 40) })
          .expect(400)
      ).body.code,
    ).toBe('until_too_far');
    await as('adminA', 'put', `/api/vendor/rewards/${rewards.cake}/sold-out`)
      .send({ until: 'tomorrow' })
      .expect(400);
    await as('adminA', 'put', `/api/vendor/rewards/${rewards.cake}/sold-out`)
      .send({})
      .expect(400);
    expect(await soldOut('adminB')).toEqual([]);
  });
});
