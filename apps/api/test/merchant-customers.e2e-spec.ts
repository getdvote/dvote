import { createHash, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { SUPABASE_JWKS } from '../src/auth/supabase-jwt.verifier';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestSigner } from './helpers/test-auth';
import type { staff_role } from '../src/generated/prisma/client.js';

const run = randomUUID();
const v = randomUUID(),
  other = randomUUID(),
  a1 = randomUUID(),
  a2 = randomUUID(),
  b1 = randomUUID();
const cards: Record<string, string> = {};
const users: string[] = [];
const tokens: Record<string, string> = {};
const staffIds: Record<string, string> = {};
const rules: Record<string, string> = {};
const privateEmail = `private-${run}@test.dvote`;
const privatePhone = '01098765432';

describe('Merchant customers: segments, profiles and private data (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const get = (who: string, suffix = '') =>
    request(app.getHttpServer())
      .get(`/api/vendor/customers${suffix}`)
      .set('Authorization', `Bearer ${tokens[who]}`);

  beforeAll(async () => {
    const signer = await createTestSigner();
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SUPABASE_JWKS)
      .useValue(signer.jwks)
      .compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.vendors.createMany({
      data: [
        { id: v, name: `Customers ${run}` },
        { id: other, name: `Other ${run}` },
      ],
    });
    await prisma.branches.createMany({
      data: [
        { id: a1, vendor_id: v, name: 'First branch' },
        { id: a2, vendor_id: v, name: 'Private other branch' },
        { id: b1, vendor_id: other, name: 'Other merchant' },
      ],
    });
    for (const [key, vendor, branch, role] of [
      ['owner', v, null, 'vendor_admin'],
      ['manager', v, a1, 'branch_manager'],
      ['cashier', v, a1, 'staff'],
      ['other', other, null, 'vendor_admin'],
    ] as [string, string, string | null, staff_role][]) {
      const auth = randomUUID();
      const staff = await prisma.staff_users.create({
        data: {
          vendor_id: vendor,
          branch_id: branch,
          name: key,
          email: `${key}-${run}@test.dvote`,
          role,
          auth_user_id: auth,
        },
      });
      staffIds[key] = staff.id;
      tokens[key] = await signer.sign(auth);
    }
    for (const vendor of [v, other])
      rules[vendor] = (
        await prisma.point_rules.create({
          data: {
            vendor_id: vendor,
            version: 1,
            spend_amount: 10,
            points_per_spend: 1,
          },
        })
      ).id;

    async function customer(
      key: string,
      name: string | null,
      vendor = v,
      existingUser?: string,
    ) {
      const user = existingUser ?? randomUUID();
      if (!existingUser) {
        users.push(user);
        await prisma.users.create({
          data: {
            id: user,
            name,
            email: key === 'new' ? privateEmail : `${randomUUID()}@test.dvote`,
            phone: key === 'new' ? privatePhone : null,
            birth_date: new Date('1995-01-01'),
            gender: 'female',
            last_lat: 30,
            last_lng: 31,
            auth_user_id: randomUUID(),
          },
        });
      }
      cards[key] = (
        await prisma.cards.create({
          data: { user_id: user, vendor_id: vendor, balance: 999 },
        })
      ).id;
      return user;
    }
    async function earn(
      key: string,
      userId: string,
      daysAgo: number,
      branch = a1,
      vendor = v,
      amount = 100,
    ) {
      const [date] = await prisma.$queryRaw<
        { at: Date }[]
      >`SELECT (((now() AT TIME ZONE 'Africa/Cairo')::date - ${daysAgo}::int)::timestamp AT TIME ZONE 'Africa/Cairo') AS at`;
      const qr = await prisma.qr_codes.create({
        data: {
          user_id: userId,
          purpose: 'collect',
          token_hash: createHash('sha256').update(randomUUID()).digest('hex'),
          status: 'used',
          used_at: date.at,
          used_by_staff_id: staffIds[vendor === v ? 'owner' : 'other'],
          used_branch_id: branch,
        },
      });
      await prisma.point_events.create({
        data: {
          vendor_id: vendor,
          card_id: cards[key],
          branch_id: branch,
          staff_id: staffIds[vendor === v ? 'owner' : 'other'],
          qr_code_id: qr.id,
          type: 'earn',
          purchase_amount: amount,
          delta: amount / 10,
          rule_id: rules[vendor],
          idempotency_key: randomUUID(),
          created_at: date.at,
          receipt_ref: privatePhone + randomUUID(),
        },
      });
    }
    const sam = await customer('new', 'Sam Example');
    await earn('new', sam, 0);
    await earn('new', sam, 0, a2, v, 200);
    const returning = await customer('returning', 'نور المصري');
    await earn('returning', returning, 40);
    await earn('returning', returning, 1);
    const regular = await customer('regular', 'Regular Customer');
    for (const age of [100, 89, 60, 40, 20, 0])
      await earn('regular', regular, age);
    const risk = await customer('risk', 'At Risk');
    for (const age of [100, 30]) await earn('risk', risk, age);
    const boundary = await customer('boundary', 'Day 29');
    await earn('boundary', boundary, 29);
    await customer('none', null);
    const branchOnly = await customer('branchOnly', 'Branch Two Only');
    await earn('branchOnly', branchOnly, 0, a2);
    await customer('other', 'Sam Example', other, sam);
    await earn('other', sam, 0, b1, other, 5000);

    const reward = await prisma.rewards.create({
      data: { vendor_id: v, name: 'Renamed reward', points_cost: 10 },
    });
    const qr = await prisma.qr_codes.create({
      data: {
        user_id: sam,
        purpose: 'redeem',
        vendor_id: v,
        reward_id: reward.id,
        token_hash: createHash('sha256').update(randomUUID()).digest('hex'),
        status: 'used',
        used_at: new Date(),
        used_by_staff_id: staffIds.owner,
        used_branch_id: a1,
      },
    });
    const event = await prisma.point_events.create({
      data: {
        vendor_id: v,
        card_id: cards.new,
        branch_id: a1,
        staff_id: staffIds.owner,
        qr_code_id: qr.id,
        type: 'redeem',
        delta: -10,
        reward_id: reward.id,
        idempotency_key: randomUUID(),
      },
    });
    await prisma.redemptions.create({
      data: {
        vendor_id: v,
        card_id: cards.new,
        branch_id: a1,
        staff_id: staffIds.owner,
        reward_id: reward.id,
        point_event_id: event.id,
        reward_name: 'Coffee at redemption',
        points_cost: 10,
      },
    });
  });

  afterAll(async () => {
    if (prisma)
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          'SET LOCAL session_replication_role = replica',
        );
        const where = { vendor_id: { in: [v, other] } };
        await tx.redemptions.deleteMany({ where });
        await tx.point_events.deleteMany({ where });
        await tx.cards.deleteMany({ where });
        await tx.qr_codes.deleteMany({ where: { user_id: { in: users } } });
        await tx.rewards.deleteMany({ where });
        await tx.point_rules.deleteMany({ where });
        await tx.staff_users.deleteMany({ where });
        await tx.branches.deleteMany({ where });
        await tx.vendors.deleteMany({ where: { id: { in: [v, other] } } });
        await tx.users.deleteMany({ where: { id: { in: users } } });
      });
    await app?.close();
  });

  it('classifies once, with exact Cairo 29/30/89-day boundaries', async () => {
    const { body } = await get('owner').expect(200);
    expect(body.customersTotal).toBe(7);
    expect(body.total).toBe(7);
    expect(body.segments).toEqual([
      { key: 'new', count: 3 },
      { key: 'returning', count: 1 },
      { key: 'regular', count: 1 },
      { key: 'at_risk', count: 1 },
      { key: 'no_visits', count: 1 },
    ]);
    expect(
      body.items.find((c: { id: string }) => c.id === cards.regular),
    ).toMatchObject({
      segment: 'regular',
      visits: 6,
      visits90d: 5,
      spend: '600.00',
    });
    expect(
      body.items.find((c: { id: string }) => c.id === cards.new),
    ).toMatchObject({
      name: 'Sam Example',
      spend: '300.00',
      visits: 2,
      averageBill: '150.00',
      rewardsRedeemed: 1,
      pointsBalance: 999,
    });
    expect(
      body.items.find((c: { id: string }) => c.id === cards.none),
    ).toMatchObject({
      name: null,
      segment: 'no_visits',
      firstVisitAt: null,
      lastVisitAt: null,
      spend: '0.00',
    });
  });

  it('searches names and references only, handles Arabic, and retains independent counts', async () => {
    const { body } = await get('owner', '?segment=regular').expect(200);
    expect(body.total).toBe(1);
    expect(body.customersTotal).toBe(7);
    expect(
      (await get('owner', `?search=${encodeURIComponent('نور')}`).expect(200))
        .body.items[0].id,
    ).toBe(cards.returning);
    expect(
      (await get('owner', `?search=${cards.new.slice(0, 8)}`).expect(200)).body
        .items[0].id,
    ).toBe(cards.new);
    for (const secret of [privateEmail, privatePhone, '%', "' OR 1=1 --"])
      expect(
        (
          await get('owner', `?search=${encodeURIComponent(secret)}`).expect(
            200,
          )
        ).body.total,
      ).toBe(0);
  });

  it('paginates and sorts stably; out-of-range pages retain totals', async () => {
    const first = (await get('owner', '?sort=spend&pageSize=2').expect(200))
      .body;
    const second = (
      await get('owner', '?sort=spend&pageSize=2&page=2').expect(200)
    ).body;
    expect(first.items[0].id).toBe(cards.regular);
    expect(
      new Set(
        [...first.items, ...second.items].map((c: { id: string }) => c.id),
      ).size,
    ).toBe(4);
    const empty = (await get('owner', '?page=999').expect(200)).body;
    expect(empty.items).toEqual([]);
    expect(empty.total).toBe(7);
  });

  it('profiles expose only allowlisted data for this merchant and snapshot reward names', async () => {
    const { body } = await get('owner', `/${cards.new}`).expect(200);
    expect(body.total).toBe(3);
    expect(
      body.events.find((e: { type: string }) => e.type === 'redeem').rewardName,
    ).toBe('Coffee at redemption');
    expect(Object.keys(body.customer).sort()).toEqual(
      [
        'id',
        'reference',
        'name',
        'segment',
        'firstVisitAt',
        'lastVisitAt',
        'visits',
        'visits90d',
        'spend',
        'averageBill',
        'rewardsRedeemed',
        'pointsBalance',
      ].sort(),
    );
    for (const field of [
      'email',
      'phone',
      'birth_date',
      'gender',
      'auth_user_id',
      'user_id',
      'receipt_ref',
      'reason',
      'avatar_path',
      'last_lat',
    ])
      expect(JSON.stringify(body)).not.toContain(`"${field}"`);
    for (const value of [
      privateEmail,
      privatePhone,
      '5000.00',
      'Other merchant',
      ...users,
    ])
      expect(JSON.stringify(body)).not.toContain(value);
    const history = (
      await get('owner', `/${cards.new}?pageSize=1&page=2`).expect(200)
    ).body;
    expect(history.events).toHaveLength(1);
    expect(history.total).toBe(3);
    await get('owner', `/${cards.other}`).expect(404);
    await get('other', `/${cards.new}`).expect(404);
    expect((await get('other').expect(200)).body.total).toBe(1);
  });

  it('managers cannot override branch scope or infer other-branch spend or balance', async () => {
    const { body } = await get('manager', `?branchId=${a2}`).expect(200);
    expect(body.total).toBe(5);
    expect(
      body.items.find((c: { id: string }) => c.id === cards.new),
    ).toMatchObject({ spend: '100.00', visits: 1, pointsBalance: null });
    await get('manager', `/${cards.branchOnly}?branchId=${a2}`).expect(404);
    const profile = (
      await get('manager', `/${cards.new}?branchId=${a2}`).expect(200)
    ).body;
    expect(profile.total).toBe(2);
    expect(JSON.stringify(profile)).not.toContain('Private other branch');
    expect((await get('owner', `?branchId=${a2}`).expect(200)).body.total).toBe(
      2,
    );
    await get('owner', `/${cards.regular}?branchId=${a2}`).expect(404);
    expect((await get('owner', `?branchId=${b1}`).expect(200)).body.total).toBe(
      0,
    );
  });

  it('refuses staff and malformed inputs', async () => {
    await get('cashier').expect(403);
    await get('cashier', `/${cards.new}`).expect(403);
    await request(app.getHttpServer()).get('/api/vendor/customers').expect(401);
    for (const q of [
      '?segment=vip',
      '?sort=email',
      '?page=0',
      '?pageSize=101',
      '?page=1.5',
      '?branchId=bad',
      '?email=test@example.com',
    ])
      await get('owner', q).expect(400);
    await get('owner', '/not-a-uuid').expect(400);
    await get('owner', `/${randomUUID()}`).expect(404);
  });
});
