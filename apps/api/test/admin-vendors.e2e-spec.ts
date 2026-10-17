import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { SUPABASE_JWKS } from './../src/auth/supabase-jwt.verifier';
import { PrismaService } from './../src/prisma/prisma.service';
import { SupabaseAdminService } from './../src/supabase/supabase-admin.service';
import { createTestSigner, type TestSigner } from './helpers/test-auth';

const run = randomUUID().slice(0, 8);

describe('Platform admin auth + /api/admin/vendors (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  const fakeAuthAdmin = {
    inviteUser: jest.fn(() =>
      Promise.resolve({ authUserId: randomUUID(), existing: false }),
    ),
    createUserWithPassword: jest.fn(),
  };
  const tokens: Record<string, string> = {};
  const adminIds: string[] = [];
  const vendorIds: string[] = [];

  async function seedAdmin(
    key: string,
    status: 'active' | 'disabled' = 'active',
  ) {
    const authId = randomUUID();
    const row = await prisma.platform_admins.create({
      data: {
        name: key,
        email: `${key}-${run}@test.dvote`,
        auth_user_id: authId,
        status,
      },
    });
    adminIds.push(row.id);
    return authId;
  }

  const api = (
    who: string | null,
    method: 'get' | 'post' | 'patch',
    path: string,
  ) => {
    const req = request(app.getHttpServer())[method](path);
    return who ? req.set('Authorization', `Bearer ${tokens[who]}`) : req;
  };

  async function createVendor(body: object) {
    const res = await api('admin', 'post', '/api/admin/vendors').send(body);
    if (res.status === 201) vendorIds.push(res.body.id);
    return res;
  }

  beforeAll(async () => {
    signer = await createTestSigner();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SUPABASE_JWKS)
      .useValue(signer.jwks)
      .overrideProvider(SupabaseAdminService)
      .useValue(fakeAuthAdmin)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const adminAuth = await seedAdmin('admin');
    tokens.admin = await signer.sign(adminAuth, { aal: 'aal2' });
    tokens.adminNoMfa = await signer.sign(adminAuth, { aal: 'aal1' });
    tokens.disabledAdmin = await signer.sign(
      await seedAdmin('disabled', 'disabled'),
      {
        aal: 'aal2',
      },
    );
    tokens.notAdmin = await signer.sign(randomUUID(), { aal: 'aal2' });
  });

  afterAll(async () => {
    await prisma.staff_users.deleteMany({
      where: { vendor_id: { in: vendorIds } },
    });
    await prisma.point_rules.deleteMany({
      where: { vendor_id: { in: vendorIds } },
    });
    await prisma.branches.deleteMany({ where: { vendor_id: { in: vendorIds } } });
    await prisma.vendors.deleteMany({ where: { id: { in: vendorIds } } });
    await prisma.platform_admins.deleteMany({
      where: { id: { in: adminIds } },
    });
    await app.close();
  });

  describe('PlatformAdminGuard', () => {
    it('no token → 401', async () => {
      await api(null, 'get', '/api/admin/vendors').expect(401);
    });

    it('signed in but not a platform admin → 403 not_admin', async () => {
      const res = await api('notAdmin', 'get', '/api/admin/vendors').expect(
        403,
      );
      expect(res.body.code).toBe('not_admin');
    });

    it('admin without two-factor (aal1) → 403 mfa_required', async () => {
      const res = await api('adminNoMfa', 'get', '/api/admin/vendors').expect(
        403,
      );
      expect(res.body.code).toBe('mfa_required');
    });

    it('disabled admin → 403 admin_disabled', async () => {
      const res = await api(
        'disabledAdmin',
        'get',
        '/api/admin/vendors',
      ).expect(403);
      expect(res.body.code).toBe('admin_disabled');
    });
  });

  describe('create (POST)', () => {
    it('creates a vendor with defaults (EGP, active, no branches/staff)', async () => {
      const res = await createVendor({
        name: `  Ecuador ${run} `,
        contactEmail: ' Owner@Ecuador.Coffee ',
      }).then((r) => r);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        name: `Ecuador ${run}`,
        contactEmail: 'owner@ecuador.coffee',
        currency: 'EGP',
        status: 'active',
        logoUrl: null,
        branchCount: 0,
        staffCount: 0,
      });
    });

    it('normalises the currency code', async () => {
      const res = await createVendor({
        name: `Dollar ${run}`,
        currency: 'usd',
      });
      expect(res.status).toBe(201);
      expect(res.body.currency).toBe('USD');
    });

    it.each([
      ['missing name', {}],
      ['empty name', { name: '   ' }],
      ['bad currency', { name: 'X', currency: 'EURO' }],
      ['bad email', { name: 'X', contactEmail: 'nope' }],
      [
        'logo without https://',
        { name: 'X', logoUrl: 'cdn.example.com/a.png' },
      ],
      ['unknown field', { name: 'X', status: 'suspended' }],
    ])('%s → 400', async (_label, body) => {
      const res = await createVendor(body);
      expect(res.status).toBe(400);
    });
  });

  describe('read (GET)', () => {
    it('lists with case-insensitive search and status filter', async () => {
      const res = await api(
        'admin',
        'get',
        `/api/admin/vendors?search=ECUADOR ${run}`,
      ).expect(200);
      expect(res.body.map((v: { name: string }) => v.name)).toEqual([
        `Ecuador ${run}`,
      ]);

      const suspended = await api(
        'admin',
        'get',
        '/api/admin/vendors?status=suspended',
      ).expect(200);
      expect(
        suspended.body.every(
          (v: { status: string }) => v.status === 'suspended',
        ),
      ).toBe(true);
    });

    it('gets one vendor; unknown → 404, non-uuid → 400', async () => {
      await api('admin', 'get', `/api/admin/vendors/${vendorIds[0]}`).expect(
        200,
      );
      const res = await api(
        'admin',
        'get',
        `/api/admin/vendors/${randomUUID()}`,
      ).expect(404);
      expect(res.body.code).toBe('vendor_not_found');
      await api('admin', 'get', '/api/admin/vendors/abc').expect(400);
    });
  });

  describe('update (PATCH)', () => {
    it('edits fields and clears logoUrl with null', async () => {
      const id = vendorIds[0];
      await api('admin', 'patch', `/api/admin/vendors/${id}`)
        .send({ logoUrl: 'https://cdn.example.com/e.png' })
        .expect(200);
      const res = await api('admin', 'patch', `/api/admin/vendors/${id}`)
        .send({ name: `Ecuador Coffee ${run}`, logoUrl: null })
        .expect(200);
      expect(res.body).toMatchObject({
        name: `Ecuador Coffee ${run}`,
        logoUrl: null,
      });
    });

    it('name and status cannot be null → 400', async () => {
      await api('admin', 'patch', `/api/admin/vendors/${vendorIds[0]}`)
        .send({ name: null })
        .expect(400);
      await api('admin', 'patch', `/api/admin/vendors/${vendorIds[0]}`)
        .send({ status: null })
        .expect(400);
    });

    it('suspend = soft delete; reactivate', async () => {
      const id = vendorIds[0];
      const res = await api('admin', 'patch', `/api/admin/vendors/${id}`)
        .send({ status: 'suspended' })
        .expect(200);
      expect(res.body.status).toBe('suspended');
      expect(await prisma.vendors.count({ where: { id } })).toBe(1);
      await api('admin', 'patch', `/api/admin/vendors/${id}`)
        .send({ status: 'active' })
        .expect(200);
    });

    it('currency can change until the vendor has a point rule → then 409 currency_locked', async () => {
      const id = vendorIds[1];
      await api('admin', 'patch', `/api/admin/vendors/${id}`)
        .send({ currency: 'EUR' })
        .expect(200);
      await prisma.point_rules.create({
        data: {
          vendor_id: id,
          version: 1,
          spend_amount: 1,
          points_per_spend: 1,
        },
      });
      const res = await api('admin', 'patch', `/api/admin/vendors/${id}`)
        .send({ currency: 'EGP' })
        .expect(409);
      expect(res.body.code).toBe('currency_locked');
      // sending the same currency is not a change
      await api('admin', 'patch', `/api/admin/vendors/${id}`)
        .send({ currency: 'EUR' })
        .expect(200);
    });

    it('unknown vendor → 404', async () => {
      await api('admin', 'patch', `/api/admin/vendors/${randomUUID()}`)
        .send({ name: 'x' })
        .expect(404);
    });
  });

  describe('platform team invitations (POST /{id}/staff)', () => {
    it('automatically makes the first member an admin, then honors selected roles and branch scope', async () => {
      const vendor = (await createVendor({ name: `Team ${run}` })).body.id as string;
      const path = `/api/admin/vendors/${vendor}/staff`;
      const email = (name: string) => `${name}-${run}@test.dvote`;
      await api('notAdmin', 'post', path).send({ name: 'Blocked', email: email('blocked'), role: 'staff' }).expect(403);
      const first = await api('admin', 'post', path).send({ name: 'Owner', email: email('first-team'), role: 'staff', branchId: randomUUID() }).expect(201);
      expect(first.body).toMatchObject({ role: 'vendor_admin', branchId: null, vendorId: vendor, invited: true });
      const branch = await prisma.branches.create({ data: { vendor_id: vendor, name: 'Team branch' } });
      for (const role of ['branch_manager', 'staff', 'viewer']) {
        const branchId = role === 'branch_manager' || role === 'staff' ? branch.id : undefined;
        const next = await api('admin', 'post', path).send({ name: role, email: email(`team-${role}`), role, branchId }).expect(201);
        expect(next.body).toMatchObject({ role, branchId: branchId ?? null, vendorId: vendor });
      }
      const calls = fakeAuthAdmin.inviteUser.mock.calls.length;
      await api('admin', 'post', path).send({ name: 'Second owner', email: email('second-owner'), role: 'vendor_admin' }).expect(409);
      await api('admin', 'post', `/api/admin/vendors/${vendor}/admins`).send({ name: 'Legacy second owner', email: email('legacy-second-owner') }).expect(409);
      await api('admin', 'post', path).send({ name: 'Missing branch', email: email('missing-branch'), role: 'staff' }).expect(400);
      const otherBranch = await prisma.branches.create({ data: { vendor_id: vendorIds[0], name: 'Other vendor' } });
      await api('admin', 'post', path).send({ name: 'Other branch', email: email('other-branch'), role: 'staff', branchId: otherBranch.id }).expect(400);
      expect(fakeAuthAdmin.inviteUser.mock.calls.length).toBe(calls);
      await api('admin', 'post', path).send({ name: 'Duplicate', email: email('first-team'), role: 'vendor_admin' }).expect(409);
      await api('admin', 'post', `/api/admin/vendors/${randomUUID()}/staff`).send({ name: 'Unknown', email: email('unknown-team'), role: 'viewer' }).expect(404);
      await prisma.staff_users.update({ where: { id: first.body.id }, data: { status: 'disabled' } });
      expect((await api('admin', 'post', path).send({ name: 'Replacement', email: email('disabled-owner-replacement'), role: 'vendor_admin' }).expect(409)).body.code).toBe('vendor_admin_exists');
      await expect(prisma.staff_users.create({ data: { vendor_id: vendor, name: 'Direct duplicate', email: email('direct-owner-duplicate'), role: 'vendor_admin' } })).rejects.toMatchObject({ code: 'P2002' });
    });

    it('concurrent first-owner invitations cannot create two vendor admins', async () => {
      const vendor = (await createVendor({ name: `Concurrent owners ${run}` })).body.id as string;
      const results = await Promise.all([0, 1].map(n => api('admin', 'post', `/api/admin/vendors/${vendor}/staff`).send({ name: `Owner ${n}`, email: `concurrent-owner-${n}-${run}@test.dvote`, role: 'vendor_admin' })));
      expect(results.map(r => r.status).sort()).toEqual([201, 409]);
      expect(results.find(r => r.status === 409)?.body.code).toBe('vendor_admin_exists');
      expect(await prisma.staff_users.count({ where: { vendor_id: vendor, role: 'vendor_admin' } })).toBe(1);
    });
  });

  describe('vendor admins (POST /{id}/admins)', () => {
    it("invites the vendor's first admin", async () => {
      const email = `Owner-${run}@Test.dvote`;
      const res = await api(
        'admin',
        'post',
        `/api/admin/vendors/${vendorIds[0]}/admins`,
      )
        .send({ name: 'Owner', email })
        .expect(201);
      expect(res.body).toMatchObject({
        role: 'vendor_admin',
        branchId: null,
        vendorId: vendorIds[0],
        email: email.toLowerCase(),
        invited: true,
      });
      expect(fakeAuthAdmin.inviteUser).toHaveBeenCalledWith(
        email.toLowerCase(),
      );

      const vendor = await api(
        'admin',
        'get',
        `/api/admin/vendors/${vendorIds[0]}`,
      ).expect(200);
      expect(vendor.body.staffCount).toBe(1);
    });

    it('same email again → 409 email_taken', async () => {
      const res = await api(
        'admin',
        'post',
        `/api/admin/vendors/${vendorIds[1]}/admins`,
      )
        .send({ name: 'Dup', email: `owner-${run}@test.dvote` })
        .expect(409);
      expect(res.body.code).toBe('email_taken');
    });

    it('unknown vendor → 404', async () => {
      await api('admin', 'post', `/api/admin/vendors/${randomUUID()}/admins`)
        .send({ name: 'X', email: `x-${run}@test.dvote` })
        .expect(404);
    });
  });
});
