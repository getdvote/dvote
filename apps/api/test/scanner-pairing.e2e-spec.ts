import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { SUPABASE_JWKS } from './../src/auth/supabase-jwt.verifier';
import type { staff_role } from './../src/generated/prisma/client.js';
import { LiveService } from './../src/live/live.service';
import { PrismaService } from './../src/prisma/prisma.service';
import { hashCode, sha256 } from '../src/scanner/scanner-token';
import { StaffService } from '../src/staff/staff.service';
import { TrialService } from '../src/trial/trial.service';
import { createTestSigner, type TestSigner } from './helpers/test-auth';

const run = randomUUID().slice(0, 8);
const ids = {
  vendorA: randomUUID(),
  vendorB: randomUUID(),
  branchA1: randomUUID(),
  branchA2: randomUUID(),
  closedA: randomUUID(),
  branchB1: randomUUID(),
};
const SCANS = '/api/vendor/scans';
const ME = '/api/vendor/scanner/me';
const CLAIM = '/api/public/scanner-pairings/claim';
const PAIRINGS = '/api/vendor/scanner-pairings';
type Pairing = { id: string; secret: string; code: string; branchName: string; expiresAt: string; expiresInSeconds: number };
type View = { id: string; state: string; pauseReason: string | null; deviceLabel: string | null; branchName: string; staffName: string };

describe('Phone scanner pairing (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  const tokens: Record<string, string> = {};
  const staffIds: Record<string, string> = {};
  let customerToken = '';
  const customerSub = randomUUID();
  let rewardId = '';

  const as = (who: string, method: 'get' | 'post' | 'patch' | 'delete', path: string) =>
    request(app.getHttpServer())[method](path).set('Authorization', `Bearer ${tokens[who]}`);
  const claim = (secret: string, code: string, deviceLabel?: string) =>
    request(app.getHttpServer()).post(CLAIM).send({ secret, code, deviceLabel });
  const wrong = (code: string) => (code === '000000' ? '000001' : '000000');

  async function seedStaff(key: string, vendorId: string, branchId: string | null, role: staff_role) {
    const authId = randomUUID();
    const row = await prisma.staff_users.create({
      data: { vendor_id: vendorId, branch_id: branchId, name: key, email: `${key}-${run}@test.dvote`, role, auth_user_id: authId },
    });
    staffIds[key] = row.id;
    tokens[key] = await signer.sign(authId);
  }

  const pair = async (who: string, branchId: string) =>
    (await as(who, 'post', PAIRINGS).send({ branchId }).expect(201)).body as Pairing;
  const list = async (who: string) => (await as(who, 'get', PAIRINGS).expect(200)).body as View[];

  const phone = (token: string, method: 'get' | 'post' | 'delete', path: string) =>
    request(app.getHttpServer())[method](path).set('Authorization', `Bearer ${token}`);

  /** A paired phone: the session token and its pairing id. */
  async function pairedPhone(who: string, branchId: string) {
    const p = await pair(who, branchId);
    const { body } = await claim(p.secret, p.code, 'iPhone').expect(200);
    return { token: body.sessionToken as string, id: p.id };
  }

  /** A customer with a fresh one-time QR. */
  async function customerQr(purpose: 'collect' | 'redeem' = 'collect', rewardId?: string) {
    const sub = customerToken;
    const { body } = await request(app.getHttpServer())
      .post('/api/app/qr-codes')
      .set('Authorization', `Bearer ${sub}`)
      .send(rewardId ? { purpose, rewardId } : { purpose })
      .expect(201);
    return body.code as string;
  }

  beforeAll(async () => {
    signer = await createTestSigner();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(SUPABASE_JWKS).useValue(signer.jwks).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.vendors.createMany({ data: [{ id: ids.vendorA, name: `Pair A ${run}` }, { id: ids.vendorB, name: `Pair B ${run}` }] });
    await prisma.branches.createMany({
      data: [
        { id: ids.branchA1, vendor_id: ids.vendorA, name: 'A1' },
        { id: ids.branchA2, vendor_id: ids.vendorA, name: 'A2' },
        { id: ids.closedA, vendor_id: ids.vendorA, name: 'Closed', status: 'closed' },
        { id: ids.branchB1, vendor_id: ids.vendorB, name: 'B1' },
      ],
    });
    await prisma.point_rules.create({ data: { vendor_id: ids.vendorA, version: 1, spend_amount: 10, points_per_spend: 1 } });
    await seedStaff('adminA', ids.vendorA, null, 'vendor_admin');
    await seedStaff('managerA1', ids.vendorA, ids.branchA1, 'branch_manager');
    await seedStaff('staffA1', ids.vendorA, ids.branchA1, 'staff');
    await seedStaff('staffA1b', ids.vendorA, ids.branchA1, 'staff');
    await seedStaff('staffA2', ids.vendorA, ids.branchA2, 'staff');
    await seedStaff('viewerA', ids.vendorA, null, 'viewer');
    await seedStaff('adminB', ids.vendorB, null, 'vendor_admin');
    rewardId = (await prisma.rewards.create({ data: { vendor_id: ids.vendorA, name: 'Coffee', points_cost: 10 } })).id;
    customerToken = await signer.sign(customerSub, {
      email: `customer-${run}@test.dvote`,
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: 'Paired Customer' },
    });
    await request(app.getHttpServer()).get('/api/app/users/me').set('Authorization', `Bearer ${customerToken}`).expect(200);
  });

  afterAll(async () => {
    const v = [ids.vendorA, ids.vendorB];
    const users = await prisma.users.findMany({ where: { auth_user_id: customerSub }, select: { id: true } });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
      await tx.scanner_pairings.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.wallet_broadcast_recipients.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.wallet_broadcasts.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.redemptions.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.point_events.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.cards.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.qr_codes.deleteMany({ where: { user_id: { in: users.map((u) => u.id) } } });
      await tx.rewards.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.point_rules.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.staff_users.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.branches.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.vendors.deleteMany({ where: { id: { in: v } } });
      await tx.users.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    });
    await app.close();
  });

  beforeEach(async () => {
    await prisma.scanner_pairings.deleteMany({ where: { vendor_id: { in: [ids.vendorA, ids.vendorB] } } });
  });

  describe('pairing', () => {
    it('pairs once with the right code', async () => {
      const p = await pair('staffA1', ids.branchA1);
      expect(p.code).toMatch(/^\d{6}$/);
      expect(p.secret).toMatch(/^[0-9a-f]{32}$/);
      expect(p.branchName).toBe('A1');
      expect(p.expiresInSeconds).toBeGreaterThan(290);
      expect(p.expiresInSeconds).toBeLessThanOrEqual(300);
      const { body } = await claim(p.secret, p.code, 'iPhone').expect(200);
      expect(body.sessionToken).toMatch(/^dvs_[0-9a-f]{64}$/);
      const hours = (new Date(body.expiresAt).getTime() - Date.now()) / 3_600_000;
      expect(hours).toBeGreaterThan(11.9);
      expect(hours).toBeLessThanOrEqual(12);
      expect((await list('staffA1'))[0]).toMatchObject({ id: p.id, state: 'active', deviceLabel: 'iPhone', branchName: 'A1', staffName: 'staffA1' });
    });

    it('never stores the secret, code or token', async () => {
      const p = await pair('staffA1', ids.branchA1);
      const { body } = await claim(p.secret, p.code).expect(200);
      const row = await prisma.scanner_pairings.findUniqueOrThrow({ where: { id: p.id } });
      expect(row.secret_hash).toBe(sha256(p.secret));
      expect(row.code_hash).toBe(hashCode(p.secret, p.code));
      expect(row.session_token_hash).toBe(sha256(body.sessionToken));
      expect(JSON.stringify(row)).not.toContain(p.secret);
      expect(JSON.stringify(row)).not.toContain(body.sessionToken);
    });

    it('cancels after 5 wrong tries', async () => {
      const p = await pair('staffA1', ids.branchA1);
      for (let i = 0; i < 5; i++) {
        expect((await claim(p.secret, wrong(p.code)).expect(400)).body.code).toBe('pairing_invalid');
      }
      expect((await claim(p.secret, p.code).expect(400)).body.code).toBe('pairing_invalid');
      expect(await list('staffA1')).toHaveLength(0);
    });

    it('still accepts the right code on the 5th try', async () => {
      const p = await pair('staffA1', ids.branchA1);
      for (let i = 0; i < 4; i++) await claim(p.secret, wrong(p.code)).expect(400);
      await claim(p.secret, p.code).expect(200);
    });

    it('rejects an expired code', async () => {
      const p = await pair('staffA1', ids.branchA1);
      await prisma.scanner_pairings.update({ where: { id: p.id }, data: { code_expires_at: new Date(Date.now() - 1000) } });
      expect((await claim(p.secret, p.code).expect(400)).body.code).toBe('pairing_invalid');
    });

    it('rejects a reused code', async () => {
      const p = await pair('staffA1', ids.branchA1);
      const first = await claim(p.secret, p.code).expect(200);
      await claim(p.secret, p.code).expect(400);
      const row = await prisma.scanner_pairings.findUniqueOrThrow({ where: { id: p.id } });
      expect(row.session_token_hash).toBe(sha256(first.body.sessionToken));
    });

    it('gives one session to two simultaneous right claims', async () => {
      const p = await pair('staffA1', ids.branchA1);
      const results = await Promise.all([claim(p.secret, p.code), claim(p.secret, p.code)]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    });

    it('counts simultaneous wrong tries exactly', async () => {
      const p = await pair('staffA1', ids.branchA1);
      await Promise.all(Array.from({ length: 4 }, () => claim(p.secret, wrong(p.code))));
      const row = await prisma.scanner_pairings.findUniqueOrThrow({ where: { id: p.id } });
      expect(row.failed_attempts).toBe(4);
    });

    it('answers the same for every failure', async () => {
      const used = await pair('staffA1', ids.branchA1);
      await claim(used.secret, used.code).expect(200);
      const expired = await pair('staffA1b', ids.branchA1);
      await prisma.scanner_pairings.update({ where: { id: expired.id }, data: { code_expires_at: new Date(Date.now() - 1000) } });
      const live = await pair('staffA2', ids.branchA2);
      const answers = [
        await claim('f'.repeat(32), '123456'),
        await claim(live.secret, wrong(live.code)),
        await claim(expired.secret, expired.code),
        await claim(used.secret, used.code),
      ];
      for (const a of answers) {
        expect(a.status).toBe(400);
        expect(a.body).toEqual(answers[0].body);
      }
      expect(answers[0].body.code).toBe('pairing_invalid');
    });

    it('replacing a code cancels only the unclaimed one', async () => {
      const paired = await pair('staffA1', ids.branchA1);
      await claim(paired.secret, paired.code).expect(200);
      const old = await pair('staffA1', ids.branchA1);
      const fresh = await pair('staffA1', ids.branchA1);
      await claim(old.secret, old.code).expect(400);
      await claim(fresh.secret, fresh.code).expect(200);
      const states = await list('staffA1');
      expect(states.map((s) => s.id).sort()).toEqual([paired.id, fresh.id].sort());
    });

    it('limits who can pair', async () => {
      expect((await as('viewerA', 'post', PAIRINGS).send({ branchId: ids.branchA1 }).expect(403)).body.code).toBe('forbidden_role');
      expect((await as('staffA1', 'post', PAIRINGS).send({ branchId: ids.branchA2 }).expect(403)).body.code).toBe('forbidden_branch');
      expect((await as('adminA', 'post', PAIRINGS).send({ branchId: ids.closedA }).expect(400)).body.code).toBe('invalid_branch');
      expect((await as('adminA', 'post', PAIRINGS).send({ branchId: ids.branchB1 }).expect(400)).body.code).toBe('invalid_branch');
      await pair('adminA', ids.branchA2);
    });

    it('scopes the list and disconnect', async () => {
      const a = await pair('staffA1', ids.branchA1);
      const b = await pair('staffA1b', ids.branchA1);
      const c = await pair('staffA2', ids.branchA2);
      for (const p of [a, b, c]) await claim(p.secret, p.code).expect(200);
      const seen = async (who: string) => (await list(who)).map((v) => v.id).sort();
      expect(await seen('staffA1')).toEqual([a.id]);
      expect(await seen('managerA1')).toEqual([a.id, b.id].sort());
      expect(await seen('adminA')).toEqual([a.id, b.id, c.id].sort());
      expect(await seen('adminB')).toEqual([]);
      expect((await as('adminB', 'delete', `${PAIRINGS}/${a.id}`).expect(404)).body.code).toBe('pairing_not_found');
      await as('staffA1', 'delete', `${PAIRINGS}/${b.id}`).expect(404);
      await as('managerA1', 'delete', `${PAIRINGS}/${c.id}`).expect(404);
      await as('managerA1', 'delete', `${PAIRINGS}/${b.id}`).expect(204);
      expect(await seen('managerA1')).toEqual([a.id]);
    });

    it('does not show other people their pending codes', async () => {
      await pair('staffA1', ids.branchA1);
      expect(await list('adminA')).toHaveLength(0);
      expect((await list('staffA1'))[0].state).toBe('pending');
    });

    it('shows a blocked state for paused phones', async () => {
      const p = await pair('staffA1', ids.branchA1);
      await claim(p.secret, p.code).expect(200);
      await prisma.branches.update({ where: { id: ids.branchA1 }, data: { status: 'closed' } });
      try {
        expect((await list('adminA'))[0]).toMatchObject({ state: 'paused', pauseReason: 'branch_closed' });
      } finally {
        await prisma.branches.update({ where: { id: ids.branchA1 }, data: { status: 'active' } });
      }
    });

    it('never touches customers or Wallet passes', async () => {
      const spy = jest.spyOn(app.get(LiveService), 'vendorChanged');
      try {
        const p = await pair('staffA1', ids.branchA1);
        const { body } = await claim(p.secret, p.code).expect(200);
        await as('adminA', 'delete', `${PAIRINGS}/${p.id}`).expect(204);
        const other = await pairedPhone('staffA1b', ids.branchA1);
        await phone(other.token, 'delete', ME).expect(204);
        expect(body.sessionToken).toBeTruthy();
        expect(spy).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    });

    it('disconnect records who and why', async () => {
      const p = await pair('staffA1', ids.branchA1);
      await claim(p.secret, p.code).expect(200);
      await as('adminA', 'delete', `${PAIRINGS}/${p.id}`).expect(204);
      const row = await prisma.scanner_pairings.findUniqueOrThrow({ where: { id: p.id } });
      expect(row).toMatchObject({ revoked_reason: 'disconnected', revoked_by_staff_id: staffIds.adminA });
      expect(await list('adminA')).toHaveLength(0);
    });
  });

  describe('phone session', () => {
    const scan = (token: string, route: string, body: object) => phone(token, 'post', `${SCANS}/${route}`).send(body);

    it('collects and redeems from a phone under the person who paired, at the pairing branch', async () => {
      const { token } = await pairedPhone('staffA1', ids.branchA1);
      const code = await customerQr();
      expect((await scan(token, 'preview', { code }).expect(200)).body.usable).toBe(true);
      const collected = (await scan(token, 'collect', { code, amount: 200, idempotencyKey: randomUUID() }).expect(200)).body;
      expect(collected.pointsAdded).toBe(20);
      const event = await prisma.point_events.findFirstOrThrow({ where: { vendor_id: ids.vendorA, delta: { gt: 0 } }, orderBy: { created_at: 'desc' } });
      expect(event).toMatchObject({ staff_id: staffIds.staffA1, branch_id: ids.branchA1 });

      const redeemCode = await customerQr('redeem', rewardId);
      await scan(token, 'redeem', { code: redeemCode, idempotencyKey: randomUUID() }).expect(200);
      const given = await prisma.redemptions.findFirstOrThrow({ where: { vendor_id: ids.vendorA }, orderBy: { created_at: 'desc' } });
      expect(given).toMatchObject({ branch_id: ids.branchA1 });
      expect((await phone(token, 'get', `${SCANS}/today`).expect(200)).body.collects).toBeGreaterThan(0);
    });

    it.each([
      ['get', '/api/vendor/customers'],
      ['get', '/api/vendor/staff'],
      ['get', '/api/vendor/staff/me'],
      ['get', '/api/vendor/profile'],
      ['get', '/api/vendor/summary'],
      ['get', '/api/vendor/scanner-pairings'],
      ['post', '/api/vendor/scanner-pairings'],
      ['get', '/api/admin/me'],
      ['get', '/api/app/users/me'],
    ] as const)('rejects a session token on %s %s', async (method, path) => {
      const { token } = await pairedPhone('adminA', ids.branchA1);
      const { status, body } = await phone(token, method, path).send(method === 'post' ? { branchId: ids.branchA1 } : undefined);
      expect(status).toBe(401);
      expect(body.code).toBe('invalid_token');
    });

    it('keeps a merchant admin phone on its branch', async () => {
      const { token } = await pairedPhone('adminA', ids.branchA1);
      const code = await customerQr();
      for (const route of ['collect', 'redeem']) {
        const { body } = await scan(token, route, { code, amount: 200, branchId: ids.branchA2, idempotencyKey: randomUUID() }).expect(403);
        expect(body.code).toBe('forbidden_branch');
      }
      expect((await scan(token, 'preview', { code, previewBranchId: ids.branchA2 }).expect(403)).body.code).toBe('forbidden_branch');
      await scan(token, 'collect', { code, amount: 200, idempotencyKey: randomUUID() }).expect(200);
      const event = await prisma.point_events.findFirstOrThrow({ where: { vendor_id: ids.vendorA, delta: { gt: 0 } }, orderBy: { created_at: 'desc' } });
      expect(event).toMatchObject({ staff_id: staffIds.adminA, branch_id: ids.branchA1 });
    });

    it('ends at 12 hours', async () => {
      const { token, id } = await pairedPhone('staffA1', ids.branchA1);
      await prisma.scanner_pairings.update({ where: { id }, data: { session_expires_at: new Date(Date.now() - 1000) } });
      const { body } = await phone(token, 'get', ME).expect(401);
      expect(body).toMatchObject({ code: 'scanner_session_ended', reason: 'expired' });
    });

    it('still ends at 12 hours during a pause', async () => {
      const { token, id } = await pairedPhone('staffA1', ids.branchA1);
      await prisma.scanner_pairings.update({ where: { id }, data: { session_expires_at: new Date(Date.now() - 1000) } });
      await prisma.vendors.update({ where: { id: ids.vendorA }, data: { status: 'suspended' } });
      try {
        expect((await phone(token, 'get', ME).expect(401)).body.reason).toBe('expired');
      } finally {
        await prisma.vendors.update({ where: { id: ids.vendorA }, data: { status: 'active' } });
      }
    });

    it('ends on Disconnect', async () => {
      const { token, id } = await pairedPhone('staffA1', ids.branchA1);
      await as('staffA1', 'delete', `${PAIRINGS}/${id}`).expect(204);
      expect((await phone(token, 'get', ME).expect(401)).body).toMatchObject({ code: 'scanner_session_ended', reason: 'disconnected' });
      await scan(token, 'preview', { code: await customerQr() }).expect(401);
    });

    it('ends on the phone\'s End session', async () => {
      const { token, id } = await pairedPhone('staffA1', ids.branchA1);
      await phone(token, 'delete', ME).expect(204);
      expect((await phone(token, 'get', ME).expect(401)).body.reason).toBe('ended_by_phone');
      const row = await prisma.scanner_pairings.findUniqueOrThrow({ where: { id } });
      expect(row.revoked_by_staff_id).toBeNull();
    });

    it('allows End session while paused', async () => {
      const { token } = await pairedPhone('staffA1', ids.branchA1);
      await prisma.vendors.update({ where: { id: ids.vendorA }, data: { status: 'suspended' } });
      try {
        await phone(token, 'delete', ME).expect(204);
      } finally {
        await prisma.vendors.update({ where: { id: ids.vendorA }, data: { status: 'active' } });
      }
      expect((await phone(token, 'get', ME).expect(401)).body.reason).toBe('ended_by_phone');
    });

    it('rejects an unknown token with no reason', async () => {
      const { body } = await phone(`dvs_${'0'.repeat(64)}`, 'get', ME).expect(401);
      expect(body.code).toBe('scanner_session_ended');
      expect(body.reason).toBeUndefined();
    });

    it('rescanning a used QR does not touch the paired phone', async () => {
      const p = await pair('staffA1', ids.branchA1);
      await claim(p.secret, p.code).expect(200);
      const first = await prisma.scanner_pairings.findUniqueOrThrow({ where: { id: p.id } });
      await claim(p.secret, p.code).expect(400);
      await claim(p.secret, wrong(p.code)).expect(400);
      const after = await prisma.scanner_pairings.findUniqueOrThrow({ where: { id: p.id } });
      expect(after.session_token_hash).toBe(first.session_token_hash);
      expect(after.revoked_at).toBeNull();
    });

    describe.each([
      ['vendor_suspended', { status: 'suspended' }, { status: 'active' }],
      ['trial_ended', { plan_status: 'trial', trial_ends_at: new Date(Date.now() - 1000), delete_at: new Date(Date.now() + 86_400_000) }, { plan_status: 'active', trial_ends_at: null, delete_at: null }],
      ['subscription_expired', { plan_status: 'active', paid_until: new Date(Date.now() - 30 * 86_400_000) }, { plan_status: 'active', paid_until: null }],
    ])('when the shop is locked: %s', (code, lock, clear) => {
      it('pauses and resumes on the same token', async () => {
        const { token } = await pairedPhone('adminA', ids.branchA1);
        await phone(token, 'get', ME).expect(200);
        await prisma.vendors.update({ where: { id: ids.vendorA }, data: lock as never });
        try {
          expect((await phone(token, 'get', ME).expect(403)).body.code).toBe(code);
          expect((await scan(token, 'preview', { code: 'x' }).expect(403)).body.code).toBe(code);
        } finally {
          await prisma.vendors.update({ where: { id: ids.vendorA }, data: clear as never });
        }
        await phone(token, 'get', ME).expect(200);
      });
    });

    it('pauses on a closed branch and resumes, for a merchant admin too', async () => {
      const staff = await pairedPhone('staffA2', ids.branchA2);
      const admin = await pairedPhone('adminA', ids.branchA2);
      await prisma.branches.update({ where: { id: ids.branchA2 }, data: { status: 'closed' } });
      try {
        expect((await phone(staff.token, 'get', ME).expect(403)).body.code).toBe('branch_closed');
        expect((await phone(admin.token, 'get', ME).expect(403)).body.code).toBe('branch_closed');
      } finally {
        await prisma.branches.update({ where: { id: ids.branchA2 }, data: { status: 'active' } });
      }
      await phone(staff.token, 'get', ME).expect(200);
      await phone(admin.token, 'get', ME).expect(200);
    });

    it('returns only the pairing branch from /scanner/me', async () => {
      const { token } = await pairedPhone('adminA', ids.branchA2);
      const { body } = await phone(token, 'get', ME).expect(200);
      expect(body.branch).toEqual({ id: ids.branchA2, name: 'A2' });
      expect(body.branches).toEqual([{ id: ids.branchA2, name: 'A2' }]);
      expect(body.role).toBe('vendor_admin');
      expect(body.vendor.name).toBe(`Pair A ${run}`);
    });

    it('does not give the phone the owner\'s email or the shop\'s plan', async () => {
      const { token } = await pairedPhone('adminA', ids.branchA1);
      const { body } = await phone(token, 'get', ME).expect(200);
      expect(JSON.stringify(body)).not.toContain('@test.dvote');
      expect(body.email).toBeUndefined();
      expect(body.vendor.plan).toBeUndefined();
      expect(body.vendor.currency).toBeDefined();
      expect(body.activeRule).toBeDefined();
    });

    it.each([
      ['staff_disabled', { status: 'disabled' }, { status: 'active' }],
      ['role_changed', { role: 'viewer', branch_id: null }, { role: 'staff', branch_id: ids.branchA1 }],
      ['branch_changed', { branch_id: ids.branchA2 }, { branch_id: ids.branchA1 }],
    ])('safety net: a mismatch found on a request ends the session as %s', async (reason, change, undo) => {
      const { token, id } = await pairedPhone('staffA1b', ids.branchA1);
      await prisma.staff_users.update({ where: { id: staffIds.staffA1b }, data: change as never });
      try {
        expect((await phone(token, 'get', ME).expect(401)).body.reason).toBe(reason);
      } finally {
        await prisma.staff_users.update({ where: { id: staffIds.staffA1b }, data: undo as never });
      }
      expect((await phone(token, 'get', ME).expect(401)).body.reason).toBe(reason);
      expect((await prisma.scanner_pairings.findUniqueOrThrow({ where: { id } })).revoked_reason).toBe(reason);
    });

    it('keeps a normal staff login working on scans', async () => {
      const code = await customerQr();
      await as('staffA1', 'post', `${SCANS}/preview`).send({ code }).expect(200);
      expect((await as('viewerA', 'post', `${SCANS}/preview`).send({ code }).expect(403)).body.code).toBe('forbidden_role');
      await request(app.getHttpServer()).post(`${SCANS}/preview`).send({ code }).expect(401);
    });
  });

  describe('staff changes end sessions for good', () => {
    const ended = async (token: string, reason: string) =>
      expect((await phone(token, 'get', ME).expect(401)).body).toMatchObject({ code: 'scanner_session_ended', reason });
    const patchStaff = (who: string, id: string, body: object) => as(who, 'patch', `/api/vendor/staff/${id}`).send(body);
    const restore = () =>
      prisma.staff_users.update({ where: { id: staffIds.staffA1b }, data: { status: 'active', role: 'staff', branch_id: ids.branchA1 } });
    afterEach(restore);

    it('ends when disabled, and stays ended after re-enabling', async () => {
      const { token, id } = await pairedPhone('staffA1b', ids.branchA1);
      await patchStaff('adminA', staffIds.staffA1b, { status: 'disabled' }).expect(200);
      const row = await prisma.scanner_pairings.findUniqueOrThrow({ where: { id } });
      expect(row.revoked_reason).toBe('staff_disabled');
      await patchStaff('adminA', staffIds.staffA1b, { status: 'active' }).expect(200);
      await ended(token, 'staff_disabled');
    });

    it('ends when a platform admin disables the staff member', async () => {
      const authId = randomUUID();
      const admin = await prisma.platform_admins.create({
        data: { name: 'Pair admin', email: `pair-admin-${run}@test.dvote`, auth_user_id: authId },
      });
      try {
        const token = await signer.sign(authId, { aal: 'aal2' });
        const phoneSession = await pairedPhone('staffA1b', ids.branchA1);
        await request(app.getHttpServer())
          .patch(`/api/admin/staff/${staffIds.staffA1b}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ status: 'disabled' })
          .expect(200);
        const row = await prisma.scanner_pairings.findUniqueOrThrow({ where: { id: phoneSession.id } });
        expect(row.revoked_reason).toBe('staff_disabled');
      } finally {
        await prisma.platform_admins.delete({ where: { id: admin.id } });
      }
    });

    it('ends on a role change', async () => {
      const { token, id } = await pairedPhone('staffA1b', ids.branchA1);
      await patchStaff('adminA', staffIds.staffA1b, { role: 'branch_manager', branchId: ids.branchA1 }).expect(200);
      expect((await prisma.scanner_pairings.findUniqueOrThrow({ where: { id } })).revoked_reason).toBe('role_changed');
      await ended(token, 'role_changed');
    });

    it('ends on a branch move, and stays ended after moving back', async () => {
      const { token, id } = await pairedPhone('staffA1b', ids.branchA1);
      await patchStaff('adminA', staffIds.staffA1b, { branchId: ids.branchA2 }).expect(200);
      expect((await prisma.scanner_pairings.findUniqueOrThrow({ where: { id } })).revoked_reason).toBe('branch_changed');
      await patchStaff('adminA', staffIds.staffA1b, { branchId: ids.branchA1 }).expect(200);
      await ended(token, 'branch_changed');
    });

    it('does not end when only the name changes', async () => {
      const { token } = await pairedPhone('staffA1b', ids.branchA1);
      await patchStaff('adminA', staffIds.staffA1b, { name: 'staffA1b' }).expect(200);
      await phone(token, 'get', ME).expect(200);
    });

    it('does not end when the same values are sent again', async () => {
      const { token } = await pairedPhone('staffA1b', ids.branchA1);
      await patchStaff('adminA', staffIds.staffA1b, { status: 'active', role: 'staff', branchId: ids.branchA1 }).expect(200);
      await phone(token, 'get', ME).expect(200);
    });

    it('leaves other staff members\' phones alone', async () => {
      const other = await pairedPhone('staffA1', ids.branchA1);
      await pairedPhone('staffA1b', ids.branchA1);
      await patchStaff('adminA', staffIds.staffA1b, { status: 'disabled' }).expect(200);
      await phone(other.token, 'get', ME).expect(200);
    });

    it('cancels an unclaimed code when staff are disabled', async () => {
      const p = await pair('staffA1b', ids.branchA1);
      await patchStaff('adminA', staffIds.staffA1b, { status: 'disabled' }).expect(200);
      await claim(p.secret, p.code).expect(400);
    });

    it('promoting to merchant admin ends the session', async () => {
      const authId = randomUUID();
      const vendorId = randomUUID();
      const branchId = randomUUID();
      await prisma.vendors.create({ data: { id: vendorId, name: `Pair C ${run}` } });
      await prisma.branches.create({ data: { id: branchId, vendor_id: vendorId, name: 'C1' } });
      const owner = await prisma.staff_users.create({
        data: { vendor_id: vendorId, branch_id: branchId, name: 'c', email: `c-${run}@test.dvote`, role: 'staff', auth_user_id: authId },
      });
      const mgrAuth = randomUUID();
      await prisma.staff_users.create({
        data: { vendor_id: vendorId, name: 'o', email: `o-${run}@test.dvote`, role: 'viewer', auth_user_id: mgrAuth },
      });
      tokens.cStaff = await signer.sign(authId);
      const { token } = await pairedPhone('cStaff', branchId);
      // no merchant admin exists yet, so the promotion path runs; done through a throwaway admin
      const adminAuth = randomUUID();
      const admin = await prisma.platform_admins.create({ data: { name: 'x', email: `x-${run}@test.dvote`, auth_user_id: adminAuth } });
      const staffService = app.get(StaffService);
      await staffService.update(
        { adminId: admin.id, staffId: admin.id, vendorId, branchId: null, role: 'vendor_admin' },
        owner.id,
        { role: 'vendor_admin' },
      );
      await ended(token, 'role_changed');
      await prisma.platform_admins.delete({ where: { id: admin.id } });
      await prisma.scanner_pairings.deleteMany({ where: { vendor_id: vendorId } });
      await prisma.staff_users.deleteMany({ where: { vendor_id: vendorId } });
      await prisma.branches.deleteMany({ where: { vendor_id: vendorId } });
      await prisma.vendors.delete({ where: { id: vendorId } });
    });

    it('purges a trial shop that has pairings', async () => {
      const vendorId = randomUUID();
      const branchId = randomUUID();
      const authId = randomUUID();
      await prisma.vendors.create({ data: { id: vendorId, name: `Pair D ${run}`, plan_status: 'trial', self_signup: true, trial_ends_at: new Date(Date.now() + 86_400_000), delete_at: new Date(Date.now() + 2 * 86_400_000) } });
      await prisma.branches.create({ data: { id: branchId, vendor_id: vendorId, name: 'D1' } });
      await prisma.staff_users.create({
        data: { vendor_id: vendorId, branch_id: branchId, name: 'd', email: `d-${run}@test.dvote`, role: 'staff', auth_user_id: authId },
      });
      tokens.dStaff = await signer.sign(authId);
      await pairedPhone('dStaff', branchId);
      await prisma.vendors.update({ where: { id: vendorId }, data: { trial_ends_at: new Date(Date.now() - 2000), delete_at: new Date(Date.now() - 1000) } });
      await app.get(TrialService).purge(vendorId);
      expect(await prisma.scanner_pairings.count({ where: { vendor_id: vendorId } })).toBe(0);
      expect(await prisma.vendors.count({ where: { id: vendorId } })).toBe(0);
    });
  });
});
