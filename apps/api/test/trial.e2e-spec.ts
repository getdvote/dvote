import { randomUUID } from 'node:crypto';
import { ForbiddenException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { SUPABASE_JWKS } from './../src/auth/supabase-jwt.verifier';
import { PrismaService } from './../src/prisma/prisma.service';
import { StorageService } from './../src/storage/storage.service';
import { SupabaseAdminService } from './../src/supabase/supabase-admin.service';
import { TrialService } from './../src/trial/trial.service';
import { TurnstileService } from './../src/trial/turnstile.service';
import { FakeStorage } from './helpers/fake-storage';
import { createTestSigner, type TestSigner } from './helpers/test-auth';

const run = randomUUID().slice(0, 8);
const DAY = 86_400_000;

describe('Self sign-up, 7-day free trial, plan activation and deletion of unpaid trials (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  let trial: TrialService;
  const storage = new FakeStorage();
  const fakeAuthAdmin = {
    deleteUser: jest.fn(() => Promise.resolve()),
    createSignupAccount: jest.fn((): Promise<'created' | 'resent' | 'taken'> => Promise.resolve('created')),
    inviteUser: jest.fn(),
    createUserWithPassword: jest.fn(),
    isConfigured: () => true,
  };
  const captcha = { verify: jest.fn((token?: string) => (token === 'ok' ? Promise.resolve() : Promise.reject(new ForbiddenException({ code: 'captcha_failed' })))) };
  const vendorIds: string[] = [];
  const http = () => request(app.getHttpServer());

  /** A confirmed email + password account (Supabase token), not yet linked to any shop. */
  async function account(email = `owner-${randomUUID().slice(0, 8)}@test.dvote`) {
    const sub = randomUUID();
    const token = await signer.sign(sub, { email, app_metadata: { provider: 'email', providers: ['email'], dvote_signup: true } });
    return { sub, email, token };
  }
  const defaultForm = { shopName: `Trial Cafe ${run}`, ownerName: 'Omar Owner', phone: '010 1234 5678' };
  const signup = (token: string, body: Record<string, unknown> = defaultForm) =>
    http().post('/api/vendor/signup').set('Authorization', `Bearer ${token}`).send(body);
  const me = (token: string) => http().get('/api/vendor/staff/me').set('Authorization', `Bearer ${token}`);
  const plan = (token: string, vendorId: string, body: Record<string, unknown>) =>
    http().post(`/api/admin/vendors/${vendorId}/plan`).set('Authorization', `Bearer ${token}`).send(body);

  let adminToken = '';
  let adminAuthId = '';
  beforeAll(async () => {
    signer = await createTestSigner();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SUPABASE_JWKS)
      .useValue(signer.jwks)
      .overrideProvider(StorageService)
      .useValue(storage)
      .overrideProvider(SupabaseAdminService)
      .useValue(fakeAuthAdmin)
      .overrideProvider(TurnstileService)
      .useValue(captcha)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    trial = app.get(TrialService);
    const adminAuth = randomUUID();
    adminAuthId = adminAuth;
    await prisma.platform_admins.create({
      data: { name: 'Trial admin', email: `trial-admin-${run}@test.dvote`, auth_user_id: adminAuth },
    });
    adminToken = await signer.sign(adminAuth, { aal: 'aal2' });
  });

  afterAll(async () => {
    const v = vendorIds;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
      await tx.point_events.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.cards.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.point_rules.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.staff_users.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.branches.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.vendors.deleteMany({ where: { id: { in: v } } });
      await tx.users.deleteMany({ where: { name: { startsWith: `TrialCustomer ${run}` } } });
      await tx.platform_admins.deleteMany({ where: { email: `trial-admin-${run}@test.dvote` } });
    });
    await app.close();
  });

  it('public sign-up: captcha first, then an unconfirmed marked account + confirmation email; taken emails refused', async () => {
    const form = { ownerName: 'Sara Owner', shopName: `Captcha Cafe ${run}`, email: `Sara-${run}@Test.dvote`, password: 'secret-pass-1', phone: '011 2345 6789' };
    const start = (body: Record<string, unknown>) => http().post('/api/public/merchant-signup').send(body);

    await start({ ...form, captchaToken: 'bad' }).expect(403);
    expect(fakeAuthAdmin.createSignupAccount).not.toHaveBeenCalled();
    expect((await start({ ...form, phone: '0123', captchaToken: 'ok' }).expect(400)).body.code).toBe('invalid_phone');
    await start({ ...form, password: 'short', captchaToken: 'ok' }).expect(400);

    expect((await start({ ...form, captchaToken: 'ok', redirectTo: 'http://localhost:5173/' }).expect(200)).body).toEqual({ sent: true });
    expect(fakeAuthAdmin.createSignupAccount).toHaveBeenCalledWith(
      `sara-${run}@test.dvote`,
      'secret-pass-1',
      { full_name: 'Sara Owner', shop_name: `Captcha Cafe ${run}`, phone: '+201123456789' },
      'http://localhost:5173/',
    );

    fakeAuthAdmin.createSignupAccount.mockResolvedValueOnce('taken');
    expect((await start({ ...form, captchaToken: 'ok' }).expect(409)).body.code).toBe('email_taken');
  });

  it('an account made by calling Supabase directly (no dvote mark) cannot open a trial shop', async () => {
    const sub = randomUUID();
    const token = await signer.sign(sub, { email: `direct-${run}@test.dvote`, app_metadata: { provider: 'email', providers: ['email'] } });
    expect((await signup(token).expect(403)).body.code).toBe('signup_required');
    expect(await prisma.staff_users.count({ where: { auth_user_id: sub } })).toBe(0);
  });

  it('sign-up creates the shop on a 7-day trial; the account is its merchant admin; once only', async () => {
    const a = await account();
    const res = await signup(a.token).expect(200);
    vendorIds.push(res.body.vendorId);
    const trialDays = (Date.parse(res.body.trialEndsAt) - Date.now()) / DAY;
    const deleteDays = (Date.parse(res.body.deleteAt) - Date.now()) / DAY;
    expect(trialDays).toBeGreaterThan(6.99);
    expect(trialDays).toBeLessThan(7.01);
    expect(deleteDays).toBeGreaterThan(29.99);
    expect(deleteDays).toBeLessThan(30.01);

    const v = await prisma.vendors.findUniqueOrThrow({ where: { id: res.body.vendorId }, include: { staff_users: true } });
    expect(v).toMatchObject({
      name: `Trial Cafe ${run}`,
      plan_status: 'trial',
      self_signup: true,
      status: 'active',
      contact_phone: '+201012345678',
      contact_email: a.email,
    });
    expect(v.staff_users).toEqual([
      expect.objectContaining({ role: 'vendor_admin', name: 'Omar Owner', auth_user_id: a.sub, branch_id: null }),
    ]);

    const mine = (await me(a.token).expect(200)).body;
    expect(mine.vendor.plan).toMatchObject({ status: 'trial', trialEndsAt: res.body.trialEndsAt, deleteAt: res.body.deleteAt });

    // again with the same account: the same shop, not a second one
    expect((await signup(a.token).expect(200)).body.vendorId).toBe(res.body.vendorId);
    expect(await prisma.staff_users.count({ where: { auth_user_id: a.sub } })).toBe(1);
  });

  it('sign-up rules: Egyptian mobile, names, signed in; a team member email or a platform admin cannot sign up', async () => {
    const a = await account();
    const bad = await signup(a.token, { shopName: 'X Shop', ownerName: 'Owner', phone: '+971501234567' }).expect(400);
    expect(bad.body.code).toBe('invalid_phone');
    await signup(a.token, { shopName: 'X', ownerName: 'Owner', phone: '01012345678' }).expect(400);
    await http().post('/api/vendor/signup').send(defaultForm).expect(401);

    // the email already belongs to a team member of another shop
    const taken = await account(`taken-${run}@test.dvote`);
    const other = (await signup(taken.token, { shopName: `Other ${run}`, ownerName: 'Owner', phone: '01012345678' }).expect(200)).body;
    vendorIds.push(other.vendorId);
    const sameEmail = await account(`taken-${run}@test.dvote`);
    expect((await signup(sameEmail.token).expect(409)).body.code).toBe('email_taken');

    const adminSigned = await signer.sign(adminAuthId, { aal: 'aal2', app_metadata: { dvote_signup: true } });
    expect((await signup(adminSigned).expect(403)).body.code).toBe('admin_account');
  });

  it('trial ends: dashboard + scans locked (trial_ended), public pages locked by the job; admin extends or activates', async () => {
    const a = await account();
    const { vendorId } = (await signup(a.token).expect(200)).body;
    vendorIds.push(vendorId);
    const slug = (await prisma.vendors.findUniqueOrThrow({ where: { id: vendorId } })).slug;
    await http().get(`/api/public/vendors/${slug}`).expect(200);

    // the 7 days pass
    await prisma.vendors.update({ where: { id: vendorId }, data: { trial_ends_at: new Date(Date.now() - 1000) } });
    const ended = (await me(a.token).expect(403)).body;
    expect(ended).toMatchObject({ code: 'trial_ended' });
    expect(ended.deleteAt).toEqual(expect.any(String));
    const scan = await http().post('/api/vendor/scans/preview').set('Authorization', `Bearer ${a.token}`).send({ code: 'dvote:c1:x' });
    expect(scan.status).toBe(403);
    expect(scan.body.code).toBe('trial_ended');

    // the job locks the public side
    const { locked } = await trial.run();
    expect(locked).toBeGreaterThanOrEqual(1);
    expect((await http().get(`/api/public/vendors/${slug}`).expect(404)).body.code).toBe('vendor_not_found');

    // admin: 3 more days → open again
    const ext = (await plan(adminToken, vendorId, { action: 'extend', days: 3 }).expect(200)).body;
    expect(ext).toMatchObject({ planStatus: 'trial', status: 'active' });
    expect((Date.parse(ext.trialEndsAt) - Date.now()) / DAY).toBeGreaterThan(2.99);
    await me(a.token).expect(200);
    await http().get(`/api/public/vendors/${slug}`).expect(200);

    // admin: activate a paid plan → no trial, never deleted
    const act = (await plan(adminToken, vendorId, { action: 'activate', plan: 'growth' }).expect(200)).body;
    expect(act).toEqual({ planStatus: 'active', plan: 'growth', trialEndsAt: null, deleteAt: null, status: 'active' });
    expect((await me(a.token).expect(200)).body.vendor.plan).toMatchObject({ status: 'active', plan: 'growth' });
    await plan(adminToken, vendorId, { action: 'extend', days: 3 }).expect(409);
    await plan(adminToken, vendorId, { action: 'activate', plan: 'gold' }).expect(400);
    await plan(a.token, vendorId, { action: 'activate', plan: 'starter' }).expect(403);
  });

  it('day 30: an unpaid trial shop is deleted with its data, images, logins and only-there customers; nothing else', async () => {
    const a = await account();
    const { vendorId } = (await signup(a.token, { shopName: `Doomed ${run}`, ownerName: 'Owner', phone: '01112345678' }).expect(200)).body;
    const keep = await account();
    const { vendorId: keptId } = (await signup(keep.token, { shopName: `Kept ${run}`, ownerName: 'Owner', phone: '01212345678' }).expect(200)).body;
    vendorIds.push(vendorId, keptId);

    // some activity: a branch, a rule, two customers (one also has a card at the kept shop), an earn
    const branch = await prisma.branches.create({ data: { vendor_id: vendorId, name: 'Main' } });
    const rule = await prisma.point_rules.create({ data: { vendor_id: vendorId, version: 1, spend_amount: 10, points_per_spend: 1 } });
    const staff = await prisma.staff_users.findFirstOrThrow({ where: { vendor_id: vendorId } });
    const onlyHere = await prisma.users.create({ data: { name: `TrialCustomer ${run} only`, phone: '+201000000001' } });
    const shared = await prisma.users.create({ data: { name: `TrialCustomer ${run} shared`, phone: '+201000000002' } });
    const card = await prisma.cards.create({ data: { user_id: onlyHere.id, vendor_id: vendorId, balance: 5 } });
    await prisma.cards.create({ data: { user_id: shared.id, vendor_id: vendorId } });
    await prisma.cards.create({ data: { user_id: shared.id, vendor_id: keptId } });
    await prisma.point_events.create({
      data: {
        card_id: card.id,
        vendor_id: vendorId,
        type: 'earn',
        delta: 5,
        purchase_amount: 50,
        rule_id: rule.id,
        staff_id: staff.id,
        branch_id: branch.id,
        scan_source: 'wallet_card',
        idempotency_key: `trial-${run}`,
      },
    });
    await storage.upload('vendors', `${vendorId}/logo/a.webp`, Buffer.from('x'), 'image/webp');
    await storage.upload('vendors', `${keptId}/logo/b.webp`, Buffer.from('y'), 'image/webp');

    // not due yet: nothing happens, and purge refuses
    expect((await trial.run()).deleted).not.toContain(vendorId);
    await expect(trial.purge(vendorId)).rejects.toThrow('not an overdue');

    // day 30 passes for the doomed shop only
    await prisma.vendors.update({
      where: { id: vendorId },
      data: { trial_ends_at: new Date(Date.now() - 2 * DAY), delete_at: new Date(Date.now() - 1000) },
    });
    const { deleted } = await trial.run();
    expect(deleted).toContain(vendorId);
    expect(deleted).not.toContain(keptId);

    expect(await prisma.vendors.findUnique({ where: { id: vendorId } })).toBeNull();
    expect(await prisma.staff_users.count({ where: { vendor_id: vendorId } })).toBe(0);
    expect(await prisma.point_events.count({ where: { vendor_id: vendorId } })).toBe(0);
    expect(await prisma.users.findUnique({ where: { id: onlyHere.id } })).toBeNull();
    expect(await prisma.users.findUnique({ where: { id: shared.id } })).not.toBeNull();
    expect(await prisma.cards.count({ where: { user_id: shared.id } })).toBe(1);
    expect(storage.list('vendors', `${vendorId}/`)).toEqual([]);
    expect(storage.list('vendors', `${keptId}/`)).toHaveLength(1);
    expect(fakeAuthAdmin.deleteUser).toHaveBeenCalledWith(a.sub);
    expect(fakeAuthAdmin.deleteUser).not.toHaveBeenCalledWith(keep.sub);
    // the ledger protection is back on after the deletion
    await expect(prisma.$executeRawUnsafe('DELETE FROM point_events WHERE vendor_id = $1', keptId)).resolves.toBe(0);
    const anyEvent = await prisma.point_events.findFirst({ select: { id: true } });
    if (anyEvent) await expect(prisma.$executeRawUnsafe('UPDATE point_events SET delta = delta WHERE id = $1::uuid', anyEvent.id)).rejects.toThrow();

    // an admin-created (not self sign-up) shop is never deleted, whatever its dates
    const adminMade = await prisma.vendors.create({ data: { name: `Admin made ${run}` } });
    vendorIds.push(adminMade.id);
    await expect(trial.purge(adminMade.id)).rejects.toThrow('not an overdue');
  });
});
