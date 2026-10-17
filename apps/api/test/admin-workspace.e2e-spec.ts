import { newQrCode } from '../src/qr-codes/qr-code.token';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { SUPABASE_JWKS } from '../src/auth/supabase-jwt.verifier';
import { PrismaService } from '../src/prisma/prisma.service';
import { cardQr, cardSecret, hashCardSecret } from '../src/wallet/card-token';
import { createTestSigner } from './helpers/test-auth';

const run = randomUUID().slice(0, 8);
describe('Platform-admin merchant workspace', () => {
  let app: INestApplication;
  let db: PrismaService;
  let adminId: string;
  let adminToken: string;
  let lowToken: string;
  let staffToken: string;
  let vendorId: string;
  let otherId: string;
  let branchId: string;
  let otherBranch: string;
  let userId: string;
  let cardId: string;
  let rewardId: string;
  let code: string;
  const path = (resource: string, id = vendorId) =>
    `/api/admin/vendors/${id}/workspace/${resource}`;
  const http = (
    method: 'get' | 'post' | 'patch',
    url: string,
    token = adminToken,
  ) =>
    request(app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${token}`);
  beforeAll(async () => {
    const signer = await createTestSigner();
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SUPABASE_JWKS)
      .useValue(signer.jwks)
      .compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    const sub = randomUUID();
    adminId = (
      await db.platform_admins.create({
        data: {
          name: `Workspace admin ${run}`,
          email: `workspace-admin-${run}@test.dvote`,
          auth_user_id: sub,
        },
      })
    ).id;
    adminToken = await signer.sign(sub, { aal: 'aal2' });
    lowToken = await signer.sign(sub, { aal: 'aal1' });
    // Seeded merchants such as Joy Corner use version/variant-zero UUIDs accepted by PostgreSQL.
    const seedStyleId = randomUUID().replace(/^(.{8}-.{4})-.{4}-.{4}-/, '$1-0000-0000-');
    vendorId = (await db.vendors.create({ data: { id: seedStyleId, name: `Workspace ${run}` } }))
      .id;
    otherId = (
      await db.vendors.create({ data: { name: `Other workspace ${run}` } })
    ).id;
    branchId = (
      await db.branches.create({
        data: { vendor_id: vendorId, name: 'Workspace branch' },
      })
    ).id;
    otherBranch = (
      await db.branches.create({
        data: { vendor_id: otherId, name: 'Other branch' },
      })
    ).id;
    const staffSub = randomUUID();
    await db.staff_users.create({
      data: {
        vendor_id: vendorId,
        name: 'Merchant owner',
        email: `workspace-staff-${run}@test.dvote`,
        auth_user_id: staffSub,
        role: 'vendor_admin',
      },
    });
    staffToken = await signer.sign(staffSub);
    await db.point_rules.create({
      data: {
        vendor_id: vendorId,
        version: 1,
        spend_amount: '10',
        points_per_spend: 1,
        min_purchase: '0',
        is_active: true,
      },
    });
    rewardId = (
      await db.rewards.create({
        data: { vendor_id: vendorId, name: 'Free coffee', points_cost: 200 },
      })
    ).id;
    userId = (
      await db.users.create({
        data: {
          name: 'Workspace customer',
          email: `workspace-user-${run}@test.dvote`,
        },
      })
    ).id;
    const secret = cardSecret('test-workspace-secret', randomUUID());
    code = cardQr(secret);
    cardId = (
      await db.cards.create({
        data: {
          vendor_id: vendorId,
          user_id: userId,
          token_hash: hashCardSecret(secret),
          google_object_id: `test.workspace.${run}`,
        },
      })
    ).id;
  });
  afterAll(async () => {
    if (!db) return;
    // Append-only history is intentionally retained in local test fixtures.
    await db.vendors.updateMany({
      where: { id: { in: [vendorId, otherId] } },
      data: { status: 'suspended' },
    });
    await db.platform_admins.updateMany({
      where: { id: adminId },
      data: { status: 'disabled' },
    });
    await app.close();
  });
  it('requires platform admin and MFA for both list and merchant handlers', async () => {
    for (const url of ['/api/admin/workspace/branches', path('profile')]) {
      await http('get', url, staffToken).expect(403);
      const low = await http('get', url, lowToken).expect(403);
      expect(low.body.code).toBe('mfa_required');
      await request(app.getHttpServer()).get(url).expect(401);
    }
  });
  it('accepts seed-style merchant IDs while rejecting malformed or missing merchants', async () => {
    expect(vendorId).toMatch(/-0000-0000-/);
    const me = await http('get', path('staff/me')).expect(200);
    expect(me.body.vendor.id).toBe(vendorId);
    const report = await http('get', path('insights')+'?from=2026-10-01&to=2026-10-18').expect(200);
    expect(report.body).toBeDefined();
    await http('get', path('profile', 'not-a-uuid')).expect(404);
    await http('get', path('profile', randomUUID())).expect(404);
  });
  it('loads every cross-merchant projection and filters/paginates by merchant', async () => {
    for (const section of [
      'branches',
      'rewards',
      'team',
      'members',
      'activity',
      'redemptions',
      'broadcast',
      'customer-feedback',
      'audit',
      'storefront',
      'card',
      'insights',
      'scan',
      'settings',
      'kit',
    ]) {
      const result = await http(
        'get',
        `/api/admin/workspace/${section}?vendorId=${vendorId}&pageSize=1`,
      ).expect(200);
      expect(Array.isArray(result.body.items)).toBe(true);
      expect(
        result.body.items.every(
          (r: { vendorId: string }) => r.vendorId === vendorId,
        ),
      ).toBe(true);
      expect(result.body.items.length).toBeLessThanOrEqual(1);
    }
    await http('get', '/api/admin/workspace/branches?page=0').expect(400);
    await http('get', '/api/admin/workspace/not-a-table').expect(404);
  });
  it('opens all vendor views as the real admin, even without a merchant admin account', async () => {
    const me = await http('get', path('staff/me', otherId)).expect(200);
    expect(me.body.id).toBe(adminId);
    expect(me.body.vendor.id).toBe(otherId);
    for (const resource of [
      'profile',
      'branches',
      'point-rules',
      'rewards',
      'images',
      'staff',
      'customers',
      'storefront',
      'customer-feedback',
      'broadcasts',
      'summary',
      'events',
      'redemptions',
      'insights',
      'insights/patterns',
      'reward-performance',
      'attention',
      'go-live',
      'scans/today',
    ]) {
      const res = await http(
        'get',
        path(resource) +
          (['insights', 'reward-performance'].includes(resource)
            ? '?from=2026-10-01&to=2026-10-17'
            : ''),
      );
      if (res.status !== 200)
        throw new Error(resource + ': ' + JSON.stringify(res.body));
    }
  });
  it('keeps writes scoped and records actor, target and outcome without request bodies', async () => {
    await http('patch', path(`branches/${otherBranch}`))
      .send({ name: 'Forbidden cross-vendor edit' })
      .expect(404);
    await http('patch', path('profile'))
      .send({ name: `Workspace updated ${run}` })
      .expect(200);
    const audit = await db.admin_actions.findMany({
      where: { vendor_id: vendorId, admin_id: adminId },
    });
    expect(audit.map((a) => a.status)).toEqual(
      expect.arrayContaining(['failed', 'succeeded']),
    );
    expect(
      (await db.branches.findUniqueOrThrow({ where: { id: otherBranch } }))
        .name,
    ).toBe('Other branch');
  });

  it('supports segment membership, sold-out controls and team access edits as admin', async () => {
    const segment = await http('post', path('customer-segments'))
      .send({ name: 'Admin segment', rules: [] })
      .expect(201);
    await request(app.getHttpServer())
      .put(path('customer-segments/' + segment.body.id + '/members/' + cardId))
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(204);
    const member = await db.customer_segment_members.findFirst({
      where: { card_id: cardId },
    });
    expect(member?.set_by_staff_id).toBeNull();
    await request(app.getHttpServer())
      .put(path('rewards/' + rewardId + '/sold-out'))
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ branchId, until: null })
      .expect(200);
    await request(app.getHttpServer())
      .delete(path('rewards/' + rewardId + '/sold-out'))
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);
    const target = await db.staff_users.findFirstOrThrow({
      where: { vendor_id: vendorId },
    });
    await http('patch', path('staff/' + target.id))
      .send({ name: 'Renamed by platform admin' })
      .expect(200);
    expect(
      (await db.staff_users.findUniqueOrThrow({ where: { id: target.id } }))
        .name,
    ).toBe('Renamed by platform admin');
  });
  it('attributes one-time QR usage to the admin, with the same replay protection', async () => {
    const token = newQrCode();
    const qr = await db.qr_codes.create({
      data: {
        user_id: userId,
        purpose: 'collect',
        vendor_id: vendorId,
        token_hash: token.tokenHash,
        expires_at: new Date(Date.now() + 300000),
      },
    });
    await http('post', path('scans/collect'))
      .send({
        code: token.code,
        amount: 10,
        branchId,
        idempotencyKey: randomUUID(),
      })
      .expect(200);
    const used = await db.qr_codes.findUniqueOrThrow({ where: { id: qr.id } });
    expect(used.used_by_admin_id).toBe(adminId);
    expect(used.used_by_staff_id).toBeNull();
    await http('post', path('scans/collect'))
      .send({
        code: token.code,
        amount: 10,
        branchId,
        idempotencyKey: randomUUID(),
      })
      .expect(409);
  });
  it('collects and redeems with platform-admin attribution, ledger integrity and idempotency', async () => {
    await http('post', path('scans/collect'))
      .send({
        code,
        amount: 4000,
        branchId: otherBranch,
        idempotencyKey: randomUUID(),
      })
      .expect(400);
    const collect = {
      code,
      amount: 4000,
      branchId,
      idempotencyKey: randomUUID(),
    };
    const earned = await http('post', path('scans/collect')).send(collect);
    if (earned.status !== 200) throw new Error(JSON.stringify(earned.body));
    expect(earned.body.pointsAdded).toBe(400);
    const replay = await http('post', path('scans/collect'))
      .send(collect)
      .expect(200);
    expect(replay.body.pointEventId).toBe(earned.body.pointEventId);
    const redemption = {
      code,
      rewardId,
      branchId,
      idempotencyKey: randomUUID(),
    };
    const redeemed = await http('post', path('scans/redeem'))
      .send(redemption)
      .expect(200);
    expect(redeemed.body.cardBalance).toBe(201);
    await http('post', path('scans/redeem')).send(redemption).expect(200);
    const events = await db.point_events.findMany({
      where: { card_id: cardId },
    });
    expect(events).toHaveLength(3);
    expect(
      events.every((e) => e.staff_id === null && e.created_by === adminId),
    ).toBe(true);
    expect(
      (await db.cards.findUniqueOrThrow({ where: { id: cardId } })).balance,
    ).toBe(events.reduce((n, e) => n + e.delta, 0));
    const record = await db.redemptions.findUniqueOrThrow({
      where: { id: redeemed.body.redemptionId },
    });
    expect(record.created_by_admin_id).toBe(adminId);
    expect(record.staff_id).toBeNull();
    const notification = await db.wallet_broadcasts.findUniqueOrThrow({
      where: {
        vendor_id_idempotency_key: {
          vendor_id: vendorId,
          idempotency_key: 'redemption:' + record.id,
        },
      },
    });
    expect(notification.created_by_admin_id).toBe(adminId);
    expect(notification.created_by).toBeNull();
    await db.vendors.update({
      where: { id: vendorId },
      data: { status: 'suspended' },
    });
    const blocked = await http('post', path('scans/collect'))
      .send({ ...collect, idempotencyKey: randomUUID() })
      .expect(403);
    expect(blocked.body.code).toBe('vendor_suspended');
    await http('get', path('profile')).expect(200);
  });
});
