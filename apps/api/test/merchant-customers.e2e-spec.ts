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
      ['viewer', v, null, 'viewer'],
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
    // joined 40 days ago without a visit: never visited (a fresh card would be "new")
    await prisma.$executeRaw`UPDATE cards SET created_at = now() - interval '40 days' WHERE id = ${cards.none}::uuid`;
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
        await tx.customer_segment_members.deleteMany({ where });
        await tx.customer_segments.deleteMany({ where });
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

  it('classifies once into the built-in segments, with exact Cairo boundaries', async () => {
    const { body } = await get('owner').expect(200);
    expect(body.customersTotal).toBe(7);
    expect(body.total).toBe(7);
    // new: Sam, Day 29, Branch Two Only · champions: 2 visits in 30 days · regulars: 1 ·
    // slipping: last visit 30 days ago after 2 visits · never visited: card 40 days old
    expect(body.segments).toEqual([
      { key: 'champions', count: 1 },
      { key: 'regulars', count: 1 },
      { key: 'new', count: 3 },
      { key: 'never_visited', count: 1 },
      { key: 'slipping', count: 1 },
      { key: 'at_risk', count: 0 },
      { key: 'lost', count: 0 },
    ]);
    expect(body.customSegments).toEqual([]);
    expect(
      body.items.find((c: { id: string }) => c.id === cards.regular),
    ).toMatchObject({
      segment: 'champions',
      customSegment: null,
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
      segment: 'never_visited',
      firstVisitAt: null,
      lastVisitAt: null,
      spend: '0.00',
    });
  });

  it('searches names and references only, handles Arabic, and retains independent counts', async () => {
    const { body } = await get('owner', '?segment=champions').expect(200);
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
        'customSegment',
        'firstVisitAt',
        'lastVisitAt',
        'visits',
        'visits90d',
        'spend',
        'averageBill',
        'rewardsRedeemed',
        'pointsBalance',
        'phone',
      ].sort(),
    );
    // the profile shows the phone (2026-10-17); email and other private fields stay out
    expect(body.customer.phone).toBe(privatePhone);
    for (const field of [
      'email',
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

  it('custom segments: rules, one per customer, hand-made changes and archive', async () => {
    const send = (method: 'post' | 'patch' | 'put' | 'delete', path: string, who = 'owner') =>
      request(app.getHttpServer())[method](`/api/vendor/customer-segments${path}`).set('Authorization', `Bearer ${tokens[who]}`);

    expect(
      (await send('post', '/preview').send({ rules: [{ field: 'visits', op: 'gte', value: 2 }] }).expect(200)).body,
    ).toEqual({ count: 4, customersTotal: 7 });
    await send('post', '/preview').send({ rules: [{ field: 'segment', op: 'gte', value: 1 }] }).expect(400);

    const big = (
      await send('post', '')
        .send({ name: 'Big visitors', rules: [{ field: 'visits', op: 'gte', value: 3 }] })
        .expect(201)
    ).body;
    expect(big).toMatchObject({ name: 'Big visitors', match: 'all', count: 1 });
    const fresh = (
      await send('post', '')
        .send({ name: 'Fresh', match: 'any', rules: [{ field: 'segment', op: 'is', value: 'new' }, { field: 'visits', op: 'gte', value: 6 }] })
        .expect(201)
    ).body;
    // Regular Customer matches both: the first segment in the list wins
    expect(fresh.count).toBe(3);
    await send('post', '').send({ name: 'fresh' }).expect(409);
    await send('post', '', 'manager').send({ name: 'Nope' }).expect(403);

    // by hand: Sam into Big visitors (beats Fresh), then out of it again
    await send('put', `/${big.id}/members/${cards.new}`).expect(204);
    let sam = (await get('owner', `/${cards.new}`).expect(200)).body.customer;
    expect(sam.customSegment).toEqual({ id: big.id, name: 'Big visitors', manual: true });
    await send('delete', `/${big.id}/members/${cards.new}`).expect(204);
    sam = (await get('owner', `/${cards.new}`).expect(200)).body.customer;
    expect(sam.customSegment).toEqual({ id: fresh.id, name: 'Fresh', manual: false });
    expect((await get('owner', `?customSegment=${big.id}`).expect(200)).body.total).toBe(1);

    await send('put', `/${big.id}/members/${cards.other}`).expect(404);
    await send('delete', `/${fresh.id}`).expect(204);
    expect((await get('owner').expect(200)).body.customSegments.map((x: { id: string }) => x.id)).toEqual([big.id]);
  });

  it('exports every matching customer with contact details, for merchant admins only', async () => {
    const { body } = await get('owner', '/export').expect(200);
    expect(body.items).toHaveLength(7);
    expect(body.truncated).toBe(false);
    expect(body.items.find((c: { id: string }) => c.id === cards.new)).toMatchObject({
      email: privateEmail,
      phone: privatePhone,
    });
    expect((await get('owner', '/export?segment=never_visited').expect(200)).body.items).toHaveLength(1);
    await get('manager', '/export').expect(403);
  });

  it('viewers read merchant-wide but change nothing', async () => {
    const { body } = await get('viewer').expect(200);
    expect(body.customersTotal).toBe(7);
    expect((await get('viewer', `/${cards.new}`).expect(200)).body.customer.phone).toBe(privatePhone);
    await get('viewer', '/export').expect(403);
    const as = (method: 'post' | 'get', path: string) =>
      request(app.getHttpServer())[method](path).set('Authorization', `Bearer ${tokens.viewer}`);
    await as('get', '/api/vendor/summary').expect(200);
    await as('get', '/api/vendor/staff/me').expect(200);
    await as('post', '/api/vendor/customer-segments').send({ name: 'Nope' }).expect(403);
    await as('post', '/api/vendor/scans/preview').send({ code: 'dvote:q1:x' }).expect(403);
    await as('get', '/api/vendor/staff').expect(403);
  });
});
