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
import { EmailService, type Email } from './../src/trial/email.service';
import { FakeStorage } from './helpers/fake-storage';
import { createTestSigner, type TestSigner } from './helpers/test-auth';

const run = randomUUID().slice(0, 8);
const DAY = 86_400_000;

describe('Self sign-up, 14-day free trial, plan activation and deletion of unpaid trials (e2e)', () => {
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
  /** Reminder emails are captured, never sent. */
  const mail: { enabled: boolean; sent: Email[]; fail: boolean; send: (e: Email) => Promise<void> } = {
    enabled: false,
    sent: [],
    fail: false,
    send: (e: Email): Promise<void> => {
      if (mail.fail) return Promise.reject(new Error('down'));
      mail.sent.push(e);
      return Promise.resolve();
    },
  };
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
  let adminId = '';
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
      .overrideProvider(EmailService)
      .useValue(mail)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    trial = app.get(TrialService);
    const adminAuth = randomUUID();
    adminAuthId = adminAuth;
    const admin = await prisma.platform_admins.create({
      data: { name: 'Trial admin', email: `trial-admin-${run}@test.dvote`, auth_user_id: adminAuth },
    });
    adminId = admin.id;
    adminToken = await signer.sign(adminAuth, { aal: 'aal2' });
  });

  afterAll(async () => {
    const v = vendorIds;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
      await tx.point_events.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.plan_requests.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.billing_reminders.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.rewards.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.cards.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.point_rules.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.staff_users.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.branches.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.vendors.deleteMany({ where: { id: { in: v } } });
      await tx.users.deleteMany({ where: { name: { startsWith: `TrialCustomer ${run}` } } });
      await tx.platform_settings.updateMany({ where: { updated_by: adminId }, data: { updated_by: null } });
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

  it('sign-up creates the shop on a 14-day trial; the account is its merchant admin; once only', async () => {
    const a = await account();
    const res = await signup(a.token).expect(200);
    vendorIds.push(res.body.vendorId);
    const trialDays = (Date.parse(res.body.trialEndsAt) - Date.now()) / DAY;
    expect(trialDays).toBeGreaterThan(13.99);
    expect(trialDays).toBeLessThan(14.01);
    // no deletion date any more: an ended trial waits for the dvote team
    expect(res.body.deleteAt).toBeNull();

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

    // the 14 days pass
    await prisma.vendors.update({ where: { id: vendorId }, data: { trial_ends_at: new Date(Date.now() - 1000) } });
    const ended = (await me(a.token).expect(403)).body;
    expect(ended).toMatchObject({ code: 'trial_ended' });
    expect(ended.deleteAt).toBeNull();
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
    const act = (await plan(adminToken, vendorId, { action: 'activate', plan: 'loyal', billingCycle: 'annual' }).expect(200)).body;
    expect(act).toEqual({
      planStatus: 'active',
      plan: 'loyal',
      billingCycle: 'annual',
      founding: false,
      paidUntil: expect.any(String),
      nextPlan: null,
      nextBillingCycle: null,
      // the paid plan covers the shop's open branches (at least one)
      paidBranches: 1,
      nextPaidBranches: null,
      trialEndsAt: null,
      deleteAt: null,
      status: 'active',
    });
    const paidDays = (Date.parse(act.paidUntil) - Date.now()) / DAY;
    expect(paidDays).toBeGreaterThan(364);
    expect(paidDays).toBeLessThan(367);
    expect((await me(a.token).expect(200)).body.vendor.plan).toMatchObject({ status: 'active', plan: 'loyal', billingCycle: 'annual', paidUntil: act.paidUntil });
    await plan(adminToken, vendorId, { action: 'extend', days: 3 }).expect(409);
    await plan(adminToken, vendorId, { action: 'activate', plan: 'gold' }).expect(400);
    await plan(adminToken, vendorId, { action: 'activate', plan: 'growth' }).expect(400);
    await plan(adminToken, vendorId, { action: 'activate', plan: 'loyal', billingCycle: 'weekly' }).expect(400);
    await plan(a.token, vendorId, { action: 'activate', plan: 'regular' }).expect(403);
  });

  it('the plan picked on dvote.co/pricing rides along the sign-up and is kept on the trial shop', async () => {
    captcha.verify.mockClear();
    fakeAuthAdmin.createSignupAccount.mockClear();
    await http()
      .post('/api/public/merchant-signup')
      .send({ ownerName: 'Picky Owner', shopName: 'Picky Cafe', email: `picky-${run}@test.dvote`, password: 'secret123', phone: '01012345678', captchaToken: 'ok', plan: 'loyal', billingCycle: 'annual' })
      .expect(200);
    expect(fakeAuthAdmin.createSignupAccount.mock.calls[0]).toEqual(
      expect.arrayContaining([expect.objectContaining({ plan: 'loyal', billing_cycle: 'annual' })]),
    );
    await http()
      .post('/api/public/merchant-signup')
      .send({ ownerName: 'Picky Owner', shopName: 'Picky Cafe', email: `picky2-${run}@test.dvote`, password: 'secret123', phone: '01012345678', captchaToken: 'ok', plan: 'gold' })
      .expect(400);

    const sub = randomUUID();
    const token = await signer.sign(sub, {
      email: `picky-${run}@test.dvote`,
      app_metadata: { provider: 'email', providers: ['email'], dvote_signup: true },
      user_metadata: { full_name: 'Picky Owner', plan: 'loyal', billing_cycle: 'annual' },
    });
    const { vendorId } = (await signup(token, { ...defaultForm, shopName: `Picky ${run}` }).expect(200)).body;
    vendorIds.push(vendorId);
    const v = await prisma.vendors.findUniqueOrThrow({ where: { id: vendorId } });
    expect(v).toMatchObject({ plan_status: 'trial', plan: 'loyal', billing_cycle: 'annual', founding: false });
  });

  it('billing page: trial pick saved; on a paid plan changes are requests dvote approves; upgrade prorated now, forced downgrade at period end', async () => {
    const a = await account();
    const { vendorId } = (await signup(a.token, { ...defaultForm, shopName: `Billing ${run}` }).expect(200)).body;
    vendorIds.push(vendorId);
    await prisma.branches.createMany({
      data: [
        { vendor_id: vendorId, name: 'Main' },
        { vendor_id: vendorId, name: 'Second' },
        { vendor_id: vendorId, name: 'Old', status: 'closed' },
      ],
    });
    const bearer = { Authorization: `Bearer ${a.token}` };
    const billing = () => http().get('/api/vendor/billing').set(bearer);
    const choose = (body: Record<string, unknown>) => http().put('/api/vendor/billing/plan').set(bearer).send(body);
    const admin = (path: string, body: Record<string, unknown> = {}) =>
      http().post(`/api/admin/plan-requests/${path}`).set('Authorization', `Bearer ${adminToken}`).send(body);

    // trial: no plan yet, every plan priced for the 2 open branches; a pick is just saved
    let b = (await billing().expect(200)).body;
    expect(b).toMatchObject({ state: 'trial', plan: null, branches: 2, paidBranches: null, trialDays: 14, paidUntil: null, scheduled: null, pendingRequest: null, requestsRequired: false });
    expect(b.plans.find((p: { id: string }) => p.id === 'loyal').monthly).toMatchObject({ monthly: 999 + 399, perPeriod: 1398 });
    b = (await choose({ plan: 'chain', billingCycle: 'annual' }).expect(200)).body;
    expect(b).toMatchObject({ state: 'trial', plan: 'chain', billingCycle: 'annual', pendingRequest: null });
    await choose({ plan: 'gold', billingCycle: 'monthly' }).expect(400);

    // dvote collects the money, activates Loyal monthly → paid for a month, covering the 2 open branches
    await plan(adminToken, vendorId, { action: 'activate', plan: 'loyal', billingCycle: 'monthly' }).expect(200);
    b = (await billing().expect(200)).body;
    expect(b).toMatchObject({ state: 'active', plan: 'loyal', billingCycle: 'monthly', paidBranches: 2, requestsRequired: true, price: { monthly: 1398 } });
    const paidUntil = b.paidUntil as string;

    // a third branch is past what the plan covers: refused (also reopening the closed one)
    const third = await http().post('/api/vendor/branches').set(bearer).send({ name: 'Third' }).expect(409);
    expect(third.body).toMatchObject({ code: 'plan_limit', limit: 'branches', max: 2, used: 2 });
    const old = await prisma.branches.findFirstOrThrow({ where: { vendor_id: vendorId, name: 'Old' } });
    expect((await http().patch(`/api/vendor/branches/${old.id}`).set(bearer).send({ status: 'active' }).expect(409)).body.limit).toBe('branches');

    // upgrade to Chain: a request, nothing changes yet; priced for the days left (about a whole month)
    b = (await choose({ plan: 'chain', billingCycle: 'monthly' }).expect(200)).body;
    expect(b).toMatchObject({ plan: 'loyal', pendingRequest: { plan: 'chain', kind: 'upgrade', status: 'pending', branches: 2 } });
    const due = b.pendingRequest.amountDue as number;
    expect(due).toBeGreaterThan(0);
    expect(due).toBeLessThanOrEqual(1999 + 499 - 1398);
    // one open request at a time
    expect((await choose({ plan: 'regular', billingCycle: 'monthly' }).expect(409)).body.code).toBe('request_pending');
    // the merchant takes it back; going up and down at once is two requests
    await http().delete('/api/vendor/billing/request').set(bearer).expect(200);
    await http().delete('/api/vendor/billing/request').set(bearer).expect(409);
    expect((await choose({ plan: 'chain', billingCycle: 'monthly', branches: 1 }).expect(400)).body.code).toBe('split_change');
    b = (await choose({ plan: 'chain', billingCycle: 'monthly', branches: 3 }).expect(200)).body;
    const upId = b.pendingRequest.id as string;

    // the admin sees it and approves: Chain with 3 branches at once, same paid period
    const list = (await http().get('/api/admin/plan-requests').set('Authorization', `Bearer ${adminToken}`).expect(200)).body;
    expect(list.items.find((r: { id: string }) => r.id === upId)).toMatchObject({ kind: 'upgrade', vendor: { id: vendorId }, from: { plan: 'loyal', branches: 2 } });
    await http().get('/api/admin/plan-requests').set(bearer).expect(403);
    expect((await admin(`${upId}/approve`, { note: 'Paid by Visa' }).expect(200)).body).toMatchObject({ status: 'approved', reviewNote: 'Paid by Visa' });
    expect((await admin(`${upId}/approve`).expect(409)).body.code).toBe('request_not_pending');
    b = (await billing().expect(200)).body;
    expect(b).toMatchObject({ plan: 'chain', paidBranches: 3, paidUntil, pendingRequest: null, lastDecision: { id: upId, status: 'approved' } });
    // now the third branch fits
    const thirdBranch = (await http().post('/api/vendor/branches').set(bearer).send({ name: 'Third' }).expect(201)).body;

    // things Regular doesn't have, to see the forced downgrade
    await prisma.vendors.update({ where: { id: vendorId }, data: { wallet_nearby_enabled: true } });
    const rewards = [];
    for (let i = 0; i < 7; i++) {
      rewards.push(await prisma.rewards.create({ data: { vendor_id: vendorId, name: `R${i} ${run}`, points_cost: 100 + i, sort_order: i } }));
    }

    // downgrade to Regular with 1 branch: must say which branch and which 5 rewards stay
    expect((await choose({ plan: 'regular', billingCycle: 'monthly', branches: 1 }).expect(400)).body).toMatchObject({ code: 'keep_required', what: 'branches', count: 1 });
    const main = await prisma.branches.findFirstOrThrow({ where: { vendor_id: vendorId, name: 'Main' } });
    expect((await choose({ plan: 'regular', billingCycle: 'monthly', branches: 1, keepBranchIds: [main.id] }).expect(400)).body).toMatchObject({ code: 'keep_required', what: 'rewards', count: 5 });
    const keepRewards = rewards.slice(2).map((r) => r.id);
    expect((await choose({ plan: 'regular', billingCycle: 'monthly', branches: 1, keepBranchIds: [main.id], keepRewardIds: keepRewards.slice(1) }).expect(400)).body.code).toBe('invalid_keep');
    b = (await choose({ plan: 'regular', billingCycle: 'monthly', branches: 1, keepBranchIds: [main.id], keepRewardIds: keepRewards }).expect(200)).body;
    expect(b.pendingRequest).toMatchObject({ kind: 'downgrade', amountDue: 0, branches: 1 });
    await admin(`${b.pendingRequest.id}/approve`).expect(200);
    // approved: nothing is taken away before the end of the paid period
    b = (await billing().expect(200)).body;
    expect(b).toMatchObject({ plan: 'chain', paidBranches: 3, scheduled: { plan: 'regular', branches: 1, startsAt: paidUntil } });
    expect(await prisma.branches.count({ where: { vendor_id: vendorId, status: 'active' } })).toBe(3);

    // the period ends: the job forces the shop down (branches closed, rewards archived, nearby off; data kept)
    await prisma.vendors.update({ where: { id: vendorId }, data: { paid_until: new Date(Date.now() - 2 * DAY) } });
    expect((await billing().expect(200)).body).toMatchObject({ state: 'grace', plan: 'chain' });
    expect((await trial.run()).switched).toBeGreaterThanOrEqual(1);
    expect((await billing().expect(200)).body).toMatchObject({ state: 'grace', plan: 'regular', paidBranches: 1, scheduled: null });
    const open = await prisma.branches.findMany({ where: { vendor_id: vendorId, status: 'active' }, select: { id: true } });
    expect(open.map((x) => x.id)).toEqual([main.id]);
    expect(await prisma.branches.count({ where: { id: thirdBranch.id, status: 'closed' } })).toBe(1);
    const active = await prisma.rewards.findMany({ where: { vendor_id: vendorId, status: 'active' }, select: { id: true } });
    expect(active.map((x) => x.id).sort()).toEqual([...keepRewards].sort());
    expect(await prisma.rewards.count({ where: { vendor_id: vendorId } })).toBe(7);
    expect((await prisma.vendors.findUniqueOrThrow({ where: { id: vendorId } })).wallet_nearby_enabled).toBe(false);

    // grace over: locked everywhere (cards keep working: the public page stays up)
    await prisma.vendors.update({ where: { id: vendorId }, data: { paid_until: new Date(Date.now() - 8 * DAY) } });
    expect((await billing().expect(403)).body).toMatchObject({ code: 'subscription_expired', paidUntil: expect.any(String) });
    await me(a.token).expect(403);
    const { slug } = await prisma.vendors.findUniqueOrThrow({ where: { id: vendorId }, select: { slug: true } });
    await http().get(`/api/public/vendors/${slug}`).expect(200);

    // dvote renews: paid one month from now, unlocked
    const ren = (await plan(adminToken, vendorId, { action: 'renew' }).expect(200)).body;
    expect((Date.parse(ren.paidUntil) - Date.now()) / DAY).toBeGreaterThan(27);
    expect((await billing().expect(200)).body).toMatchObject({ state: 'active', plan: 'regular' });

    // a rejected request changes nothing; a request made before the plan changed can't be approved
    const rej = (await choose({ plan: 'loyal', billingCycle: 'annual' }).expect(200)).body.pendingRequest.id as string;
    expect((await admin(`${rej}/reject`, { note: 'Not paid' }).expect(200)).body).toMatchObject({ status: 'rejected' });
    expect((await billing().expect(200)).body).toMatchObject({ plan: 'regular', pendingRequest: null, lastDecision: { status: 'rejected', reviewNote: 'Not paid' } });
    const stale = (await choose({ plan: 'loyal', billingCycle: 'monthly' }).expect(200)).body.pendingRequest.id as string;
    await plan(adminToken, vendorId, { action: 'activate', plan: 'chain', billingCycle: 'monthly' }).expect(200);
    expect((await admin(`${stale}/approve`).expect(409)).body.code).toBe('request_outdated');
  });

  it('reminder emails: 5 days before and on the end of a trial or paid period, once each, retried when sending fails', async () => {
    const a = await account();
    const { vendorId } = (await signup(a.token, { ...defaultForm, shopName: `Remind ${run}` }).expect(200)).body;
    vendorIds.push(vendorId);
    const mine = () => mail.sent.filter((e) => e.to === a.email);

    // without Resend configured nothing is sent or recorded
    await prisma.vendors.update({ where: { id: vendorId }, data: { trial_ends_at: new Date(Date.now() + 3 * DAY) } });
    await trial.run();
    expect(mine()).toHaveLength(0);
    mail.enabled = true;
    try {
      // more than 5 days left: nothing yet
      await prisma.vendors.update({ where: { id: vendorId }, data: { trial_ends_at: new Date(Date.now() + 6 * DAY) } });
      await trial.run();
      expect(mine()).toHaveLength(0);

      // 3 days left: one email to the merchant admin, Arabic and English, with the billing link; never twice
      const ends = new Date(Date.now() + 3 * DAY);
      await prisma.vendors.update({ where: { id: vendorId }, data: { trial_ends_at: ends } });
      await trial.run();
      await trial.run();
      expect(mine()).toHaveLength(1);
      expect(mine()[0].subject).toContain('Your dvote free trial ends');
      expect(mine()[0].text).toContain('/settings?tab=billing');
      expect(mine()[0].html).toContain('dir="rtl"');

      // the trial ends while sending fails: nothing recorded, tried again on the next run
      await prisma.vendors.update({ where: { id: vendorId }, data: { trial_ends_at: new Date(Date.now() - 1000) } });
      mail.fail = true;
      await trial.run();
      expect(mine()).toHaveLength(1);
      mail.fail = false;
      await trial.run();
      expect(mine()).toHaveLength(2);
      expect(mine()[1].subject).toContain('free trial has ended');

      // a paid period: 5 days before, then on the end date
      await plan(adminToken, vendorId, { action: 'activate', plan: 'regular', billingCycle: 'monthly' }).expect(200);
      await prisma.vendors.update({ where: { id: vendorId }, data: { paid_until: new Date(Date.now() + 4 * DAY) } });
      await trial.run();
      await prisma.vendors.update({ where: { id: vendorId }, data: { paid_until: new Date(Date.now() - 1000) } });
      await trial.run();
      expect(mine().slice(2).map((e) => e.subject.split(' · ')[1])).toEqual([expect.stringContaining('renews'), 'Your dvote subscription has ended']);
      expect(await prisma.billing_reminders.count({ where: { vendor_id: vendorId } })).toBe(4);
    } finally {
      mail.enabled = false;
    }
  });

  it('billing is for the merchant admin only; renew needs an active plan', async () => {
    const a = await account();
    const { vendorId } = (await signup(a.token, { ...defaultForm, shopName: `Billing roles ${run}` }).expect(200)).body;
    vendorIds.push(vendorId);
    const sub = randomUUID();
    await prisma.staff_users.create({ data: { vendor_id: vendorId, role: 'viewer', name: 'Vera Viewer', email: `viewer-${run}@test.dvote`, auth_user_id: sub } });
    const viewer = await signer.sign(sub, { email: `viewer-${run}@test.dvote` });
    await http().get('/api/vendor/billing').set('Authorization', `Bearer ${viewer}`).expect(403);
    await http().put('/api/vendor/billing/plan').set('Authorization', `Bearer ${viewer}`).send({ plan: 'chain', billingCycle: 'monthly' }).expect(403);
    expect((await plan(adminToken, vendorId, { action: 'renew' }).expect(409)).body.code).toBe('not_active');
  });

  it('Founding Merchants: admin sets the spots, public plans show what is left, the last spot is taken once', async () => {
    const before = await prisma.platform_settings.findUniqueOrThrow({ where: { key: 'founding' } });
    try {
      const pub = (await http().get('/api/public/plans').expect(200)).body;
      expect(pub).toMatchObject({ currency: 'EGP', trialDays: 14 });
      expect(pub.plans.map((p: { id: string; monthly: number }) => [p.id, p.monthly])).toEqual([
        ['regular', 499],
        ['loyal', 999],
        ['chain', 1999],
      ]);
      await http().put('/api/admin/settings/founding').send({ total: 3, open: true }).expect(401);

      // exactly one spot left
      const taken = await prisma.vendors.count({ where: { founding: true } });
      const set = (await http().put('/api/admin/settings/founding').set('Authorization', `Bearer ${adminToken}`).send({ total: taken + 1, open: true }).expect(200)).body;
      expect(set).toEqual({ total: taken + 1, open: true, taken, left: 1 });
      expect((await http().get('/api/public/plans').expect(200)).body.founding).toMatchObject({ left: 1, discountPercent: 30, months: 6 });
      await http().put('/api/admin/settings/founding').set('Authorization', `Bearer ${adminToken}`).send({ total: -1, open: true }).expect(400);

      const shops = [];
      for (let i = 0; i < 2; i++) {
        const a = await account();
        const { vendorId } = (await signup(a.token, { ...defaultForm, shopName: `Founding ${i} ${run}` }).expect(200)).body;
        vendorIds.push(vendorId);
        shops.push(vendorId as string);
      }
      // both ask for the last spot at once: exactly one gets it
      const res = await Promise.all(shops.map((id) => plan(adminToken, id, { action: 'activate', plan: 'regular', founding: true })));
      expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(res.find((r) => r.status === 409)?.body.code).toBe('founding_full');
      const winner = res.find((r) => r.status === 200)!.body;
      expect(winner).toMatchObject({ plan: 'regular', billingCycle: 'monthly', founding: true });
      expect((await http().get('/api/public/plans').expect(200)).body.founding).toMatchObject({ taken: taken + 1, left: 0 });

      // a founding shop changing plan keeps its spot; closed offer shows 0 left
      const winnerId = shops[res.findIndex((r) => r.status === 200)];
      await plan(adminToken, winnerId, { action: 'activate', plan: 'chain', founding: true }).expect(200);
      await http().put('/api/admin/settings/founding').set('Authorization', `Bearer ${adminToken}`).send({ total: 50, open: false }).expect(200);
      expect((await http().get('/api/admin/settings/founding').set('Authorization', `Bearer ${adminToken}`).expect(200)).body.left).toBe(0);
    } finally {
      await prisma.platform_settings.update({ where: { key: 'founding' }, data: { value: before.value as object, updated_by: before.updated_by } });
    }
  });

  it('an ended trial is never deleted by itself; the admin deletes it by hand (typed name) with its data, images, logins and only-there customers; nothing else', async () => {
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

    const del = (id: string, confirmName: string, token = adminToken) =>
      http().delete(`/api/admin/vendors/${id}`).set('Authorization', `Bearer ${token}`).send({ confirmName });
    const { name } = await prisma.vendors.findUniqueOrThrow({ where: { id: vendorId }, select: { name: true } });

    // a running trial can't be deleted, and neither purge nor the job deletes anything
    expect((await del(vendorId, name).expect(409)).body.code).toBe('not_deletable');
    await expect(trial.purge(vendorId)).rejects.toThrow();

    // long past day 30, with an old deletion date: the job still keeps the shop (locked)
    await prisma.vendors.update({
      where: { id: vendorId },
      data: { trial_ends_at: new Date(Date.now() - 40 * DAY), delete_at: new Date(Date.now() - 10 * DAY) },
    });
    await trial.run();
    expect(await prisma.vendors.findUnique({ where: { id: vendorId }, select: { status: true } })).toEqual({ status: 'suspended' });

    // only a platform admin, and only with the shop's exact name
    await http().delete(`/api/admin/vendors/${vendorId}`).send({ confirmName: name }).expect(401);
    expect((await del(vendorId, 'wrong name').expect(400)).body.code).toBe('name_mismatch');
    await del(vendorId, name).expect(204);
    expect((await del(keptId, 'anything').expect(409)).body.code).toBe('not_deletable');

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
    await expect(trial.purge(adminMade.id)).rejects.toThrow();
  });
});

describe('Sign-up account creation never changes an existing account from the public path', () => {
  const existingId = randomUUID();
  /** A fake Supabase client: createUser says the email exists; the stored account is unconfirmed or confirmed. */
  function service(user: { email_confirmed_at: string | null; app_metadata: Record<string, unknown> }) {
    const admin = {
      createUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: { code: 'email_exists', message: 'already registered' } })),
      generateLink: jest.fn(() => Promise.resolve({ data: { user: { id: existingId } }, error: null })),
      getUserById: jest.fn(() => Promise.resolve({ data: { user: { id: existingId, ...user } }, error: null })),
      updateUserById: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      deleteUser: jest.fn(() => Promise.resolve({ data: null, error: null })),
    };
    const resend = jest.fn(() => Promise.resolve({ data: {}, error: null }));
    const config = { get: (key: string) => ({ SUPABASE_URL: 'http://supabase.test', NODE_ENV: 'test', PORT: 3000 })[key] };
    const svc = new SupabaseAdminService(config as never);
    (svc as unknown as { client: unknown }).client = { auth: { admin, resend } };
    return { svc, admin, resend };
  }
  const details = { full_name: 'Attacker', shop_name: 'Attacker Shop', phone: '+201000000000' };

  it('an unconfirmed dvote sign-up only gets the confirmation email again: password and details untouched', async () => {
    const { svc, admin, resend } = service({ email_confirmed_at: null, app_metadata: { dvote_signup: true } });
    await expect(svc.createSignupAccount('victim@test.dvote', 'attacker-pass', details, 'http://localhost:5173/')).resolves.toBe('resent');
    expect(admin.updateUserById).not.toHaveBeenCalled();
    expect(admin.deleteUser).not.toHaveBeenCalled();
    expect(resend).toHaveBeenCalledWith({ type: 'signup', email: 'victim@test.dvote', options: { emailRedirectTo: 'http://localhost:5173/' } });
  });

  it('a confirmed or non-sign-up account is taken: nothing changed, no email', async () => {
    for (const user of [
      { email_confirmed_at: new Date().toISOString(), app_metadata: { dvote_signup: true } },
      { email_confirmed_at: null, app_metadata: {} },
    ]) {
      const { svc, admin, resend } = service(user);
      await expect(svc.createSignupAccount('someone@test.dvote', 'attacker-pass', details)).resolves.toBe('taken');
      expect(admin.updateUserById).not.toHaveBeenCalled();
      expect(admin.deleteUser).not.toHaveBeenCalled();
      expect(resend).not.toHaveBeenCalled();
    }
  });
});
