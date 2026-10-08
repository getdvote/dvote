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
import { SupabaseAdminService } from './../src/supabase/supabase-admin.service';
import { createTestSigner, type TestSigner } from './helpers/test-auth';

/** Two vendors so we can prove one vendor's staff never see the other's. */
const run = randomUUID().slice(0, 8);
const ids = {
  vendorA: randomUUID(),
  vendorB: randomUUID(),
  branchA1: randomUUID(),
  branchA2: randomUUID(),
  branchAClosed: randomUUID(),
  branchB1: randomUUID(),
};

interface Seeded {
  id: string;
  authId: string;
  email: string;
}

describe('Staff auth + /api/vendor/staff (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  const invites: string[] = [];
  const fakeAuthAdmin = {
    inviteUser: jest.fn((email: string) => {
      invites.push(email);
      return Promise.resolve({ authUserId: randomUUID(), existing: false });
    }),
    createUserWithPassword: jest.fn(),
  };

  const people: Record<string, Seeded> = {};
  const tokens: Record<string, string> = {};

  async function seedStaff(
    key: string,
    vendorId: string,
    branchId: string | null,
    role: staff_role,
    status: 'active' | 'disabled' = 'active',
  ) {
    const authId = randomUUID();
    const email = `${key}-${run}@test.dvote`;
    const row = await prisma.staff_users.create({
      data: {
        vendor_id: vendorId,
        branch_id: branchId,
        name: key,
        email,
        role,
        status,
        auth_user_id: authId,
      },
    });
    people[key] = { id: row.id, authId, email };
    tokens[key] = await signer.sign(authId, { email });
  }

  const api = (
    who: string | null,
    method: 'get' | 'post' | 'patch',
    path: string,
  ) => {
    const req = request(app.getHttpServer())[method](path);
    return who ? req.set('Authorization', `Bearer ${tokens[who]}`) : req;
  };

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

    await prisma.vendors.createMany({
      data: [
        { id: ids.vendorA, name: `Vendor A ${run}` },
        { id: ids.vendorB, name: `Vendor B ${run}` },
      ],
    });
    await prisma.branches.createMany({
      data: [
        { id: ids.branchA1, vendor_id: ids.vendorA, name: 'A1' },
        { id: ids.branchA2, vendor_id: ids.vendorA, name: 'A2' },
        {
          id: ids.branchAClosed,
          vendor_id: ids.vendorA,
          name: 'A closed',
          status: 'closed',
        },
        { id: ids.branchB1, vendor_id: ids.vendorB, name: 'B1' },
      ],
    });
    await seedStaff('adminA', ids.vendorA, null, 'vendor_admin');
    await seedStaff('adminA2', ids.vendorA, null, 'vendor_admin');
    await seedStaff('managerA1', ids.vendorA, ids.branchA1, 'branch_manager');
    await seedStaff('managerA2', ids.vendorA, ids.branchA2, 'branch_manager');
    await seedStaff('staffA1', ids.vendorA, ids.branchA1, 'staff');
    await seedStaff('staffA2', ids.vendorA, ids.branchA2, 'staff');
    await seedStaff(
      'disabledA1',
      ids.vendorA,
      ids.branchA1,
      'staff',
      'disabled',
    );
    await seedStaff('adminB', ids.vendorB, null, 'vendor_admin');
    await seedStaff('staffB1', ids.vendorB, ids.branchB1, 'staff');
  });

  afterAll(async () => {
    const vendorIds = [ids.vendorA, ids.vendorB];
    await prisma.staff_users.deleteMany({
      where: { vendor_id: { in: vendorIds } },
    });
    await prisma.branches.deleteMany({
      where: { vendor_id: { in: vendorIds } },
    });
    await prisma.vendors.deleteMany({ where: { id: { in: vendorIds } } });
    await app.close();
  });

  beforeEach(() => {
    fakeAuthAdmin.inviteUser.mockClear();
  });

  describe('StaffAuthGuard', () => {
    it('no token → 401', async () => {
      await api(null, 'get', '/api/vendor/staff/me').expect(401);
    });

    it('signed-in account without a staff row (e.g. a customer) → 403 not_staff', async () => {
      tokens.customer = await signer.sign(randomUUID(), {
        app_metadata: { provider: 'google', providers: ['google'] },
      });
      const res = await api('customer', 'get', '/api/vendor/staff/me').expect(
        403,
      );
      expect(res.body.code).toBe('not_staff');
    });

    it('disabled staff → 403 staff_disabled', async () => {
      const res = await api('disabledA1', 'get', '/api/vendor/staff/me').expect(
        403,
      );
      expect(res.body.code).toBe('staff_disabled');
    });

    it('GET /api/vendor/staff/me works for every role, including staff', async () => {
      const res = await api('staffA1', 'get', '/api/vendor/staff/me').expect(
        200,
      );
      expect(res.body).toMatchObject({
        id: people.staffA1.id,
        role: 'staff',
        vendorId: ids.vendorA,
        branchId: ids.branchA1,
      });
    });

    it('the staff role cannot manage staff → 403 forbidden_role', async () => {
      const res = await api('staffA1', 'get', '/api/vendor/staff').expect(403);
      expect(res.body.code).toBe('forbidden_role');
    });

    it('suspended vendor → 403 vendor_suspended', async () => {
      await prisma.vendors.update({
        where: { id: ids.vendorB },
        data: { status: 'suspended' },
      });
      try {
        const res = await api('adminB', 'get', '/api/vendor/staff/me').expect(
          403,
        );
        expect(res.body.code).toBe('vendor_suspended');
      } finally {
        await prisma.vendors.update({
          where: { id: ids.vendorB },
          data: { status: 'active' },
        });
      }
    });
  });

  describe('tenant scoping', () => {
    it('vendor_admin lists only their own vendor', async () => {
      const res = await api('adminA', 'get', '/api/vendor/staff').expect(200);
      const vendorIds = new Set(
        res.body.map((s: { vendorId: string }) => s.vendorId),
      );
      expect([...vendorIds]).toEqual([ids.vendorA]);
      expect(res.body).toHaveLength(7);
    });

    it("vendor A's admin cannot read vendor B's staff → 404", async () => {
      await api(
        'adminA',
        'get',
        `/api/vendor/staff/${people.staffB1.id}`,
      ).expect(404);
    });

    it('branch_manager lists only their branch', async () => {
      const res = await api('managerA1', 'get', '/api/vendor/staff').expect(
        200,
      );
      expect(
        res.body.every(
          (s: { branchId: string }) => s.branchId === ids.branchA1,
        ),
      ).toBe(true);
      expect(res.body.map((s: { id: string }) => s.id)).not.toContain(
        people.staffA2.id,
      );
    });

    it('branch_manager cannot read another branch → 404', async () => {
      await api(
        'managerA1',
        'get',
        `/api/vendor/staff/${people.staffA2.id}`,
      ).expect(404);
    });

    it('filters by role and status', async () => {
      const res = await api(
        'adminA',
        'get',
        '/api/vendor/staff?role=staff&status=disabled',
      ).expect(200);
      expect(res.body.map((s: { id: string }) => s.id)).toEqual([
        people.disabledA1.id,
      ]);
    });

    it('rejects a non-uuid id → 400', async () => {
      await api('adminA', 'get', '/api/vendor/staff/not-a-uuid').expect(400);
    });
  });

  describe('create (POST)', () => {
    it('vendor_admin invites a branch_manager', async () => {
      const email = `New.Manager-${run}@Test.dvote`;
      const res = await api('adminA', 'post', '/api/vendor/staff')
        .send({
          name: '  New Manager ',
          email,
          role: 'branch_manager',
          branchId: ids.branchA2,
        })
        .expect(201);
      expect(res.body).toMatchObject({
        name: 'New Manager',
        email: email.toLowerCase(),
        role: 'branch_manager',
        branchId: ids.branchA2,
        vendorId: ids.vendorA,
        status: 'active',
        invited: true,
      });
      expect(fakeAuthAdmin.inviteUser).toHaveBeenCalledWith(
        email.toLowerCase(),
      );
      const row = await prisma.staff_users.findUniqueOrThrow({
        where: { id: res.body.id },
      });
      expect(row.auth_user_id).toBeTruthy();
    });

    it('duplicate email (any case) → 409 email_taken, no invite sent', async () => {
      const res = await api('adminA', 'post', '/api/vendor/staff')
        .send({
          name: 'Dup',
          email: people.staffB1.email.toUpperCase(),
          role: 'vendor_admin',
        })
        .expect(409);
      expect(res.body.code).toBe('email_taken');
      expect(fakeAuthAdmin.inviteUser).not.toHaveBeenCalled();
    });

    it.each([
      ['staff without branch', { role: 'staff' }, 'branch_required'],
      [
        'vendor_admin with a branch',
        { role: 'vendor_admin', branchId: ids.branchA1 },
        'branch_not_allowed',
      ],
      [
        "another vendor's branch",
        { role: 'staff', branchId: ids.branchB1 },
        'invalid_branch',
      ],
      [
        'a closed branch',
        { role: 'staff', branchId: ids.branchAClosed },
        'invalid_branch',
      ],
    ])('%s → 400 %s', async (_label, body, code) => {
      const res = await api('adminA', 'post', '/api/vendor/staff')
        .send({ name: 'X', email: `x-${randomUUID()}@test.dvote`, ...body })
        .expect(400);
      expect(res.body.code).toBe(code);
      expect(fakeAuthAdmin.inviteUser).not.toHaveBeenCalled();
    });

    it('rejects invalid input and unknown fields → 400', async () => {
      const post = (body: object) =>
        api('adminA', 'post', '/api/vendor/staff').send(body);
      await post({
        name: 'X',
        email: 'nope',
        role: 'staff',
        branchId: ids.branchA1,
      }).expect(400);
      await post({
        name: 'X',
        email: `y-${run}@test.dvote`,
        role: 'owner',
      }).expect(400);
      await post({
        name: 'X',
        email: `z-${run}@test.dvote`,
        role: 'vendor_admin',
        vendorId: ids.vendorB,
      }).expect(400);
    });

    it('branch_manager adds staff to their own branch (branch defaults to theirs)', async () => {
      const res = await api('managerA1', 'post', '/api/vendor/staff')
        .send({
          name: 'Barista',
          email: `barista-${run}@test.dvote`,
          role: 'staff',
        })
        .expect(201);
      expect(res.body).toMatchObject({ role: 'staff', branchId: ids.branchA1 });
    });

    it('branch_manager cannot add a manager or admin → 403 forbidden_role', async () => {
      const res = await api('managerA1', 'post', '/api/vendor/staff')
        .send({
          name: 'M',
          email: `m-${run}@test.dvote`,
          role: 'branch_manager',
          branchId: ids.branchA1,
        })
        .expect(403);
      expect(res.body.code).toBe('forbidden_role');
    });

    it('branch_manager cannot add staff to another branch → 403 forbidden_branch', async () => {
      const res = await api('managerA1', 'post', '/api/vendor/staff')
        .send({
          name: 'S',
          email: `s-${run}@test.dvote`,
          role: 'staff',
          branchId: ids.branchA2,
        })
        .expect(403);
      expect(res.body.code).toBe('forbidden_branch');
    });
  });

  describe('update (PATCH)', () => {
    it('vendor_admin moves staff to another branch and renames them', async () => {
      const res = await api(
        'adminA',
        'patch',
        `/api/vendor/staff/${people.staffA2.id}`,
      )
        .send({ name: 'Moved', branchId: ids.branchA1 })
        .expect(200);
      expect(res.body).toMatchObject({ name: 'Moved', branchId: ids.branchA1 });
    });

    it('promoting to vendor_admin clears the branch', async () => {
      const res = await api(
        'adminA',
        'patch',
        `/api/vendor/staff/${people.managerA2.id}`,
      )
        .send({ role: 'vendor_admin' })
        .expect(200);
      expect(res.body).toMatchObject({ role: 'vendor_admin', branchId: null });
    });

    it('demoting a vendor_admin requires a branch → 400 branch_required', async () => {
      const res = await api(
        'adminA',
        'patch',
        `/api/vendor/staff/${people.adminA2.id}`,
      )
        .send({ role: 'staff' })
        .expect(400);
      expect(res.body.code).toBe('branch_required');
    });

    it('disabling is a soft delete: the person is blocked immediately', async () => {
      await api('adminA', 'patch', `/api/vendor/staff/${people.staffA1.id}`)
        .send({ status: 'disabled' })
        .expect(200);
      const res = await api('staffA1', 'get', '/api/vendor/staff/me').expect(
        403,
      );
      expect(res.body.code).toBe('staff_disabled');
      expect(
        await prisma.staff_users.count({ where: { id: people.staffA1.id } }),
      ).toBe(1);

      await api('adminA', 'patch', `/api/vendor/staff/${people.staffA1.id}`)
        .send({ status: 'active' })
        .expect(200);
      await api('staffA1', 'get', '/api/vendor/staff/me').expect(200);
    });

    it('vendor_admin cannot change their own role or status → 403 cannot_modify_self', async () => {
      const res = await api(
        'adminA',
        'patch',
        `/api/vendor/staff/${people.adminA.id}`,
      )
        .send({ status: 'disabled' })
        .expect(403);
      expect(res.body.code).toBe('cannot_modify_self');
    });

    it('anyone allowed can still rename themselves', async () => {
      await api('adminA', 'patch', `/api/vendor/staff/${people.adminA.id}`)
        .send({ name: 'Admin A' })
        .expect(200);
    });

    it('email cannot be changed → 400', async () => {
      await api('adminA', 'patch', `/api/vendor/staff/${people.staffA1.id}`)
        .send({ email: `new-${run}@test.dvote` })
        .expect(400);
    });

    it("vendor A's admin cannot edit vendor B's staff → 404", async () => {
      await api('adminA', 'patch', `/api/vendor/staff/${people.staffB1.id}`)
        .send({ name: 'hacked' })
        .expect(404);
    });

    it('branch_manager can rename / disable staff in their branch', async () => {
      await api(
        'managerA1',
        'patch',
        `/api/vendor/staff/${people.disabledA1.id}`,
      )
        .send({ name: 'Renamed', status: 'active' })
        .expect(200);
    });

    it('branch_manager cannot change role or branch → 403 forbidden_role_change', async () => {
      const res = await api(
        'managerA1',
        'patch',
        `/api/vendor/staff/${people.disabledA1.id}`,
      )
        .send({ branchId: ids.branchA2 })
        .expect(403);
      expect(res.body.code).toBe('forbidden_role_change');
    });

    it('branch_manager cannot edit a vendor_admin → 404 (outside their branch)', async () => {
      await api('managerA1', 'patch', `/api/vendor/staff/${people.adminA.id}`)
        .send({ name: 'x' })
        .expect(404);
    });
  });

  describe('own vendor profile (/api/vendor/profile)', () => {
    it('every staff role sees their own vendor, never another', async () => {
      const a = await api('staffA2', 'get', '/api/vendor/profile').expect(200);
      expect(a.body.id).toBe(ids.vendorA);
      const b = await api('adminB', 'get', '/api/vendor/profile').expect(200);
      expect(b.body.id).toBe(ids.vendorB);
    });

    it('vendor_admin edits name, logo and contact email of their own vendor only', async () => {
      const res = await api('adminA', 'patch', '/api/vendor/profile')
        .send({ name: `Vendor A renamed ${run}`, contactEmail: 'Owner@A.test' })
        .expect(200);
      expect(res.body).toMatchObject({
        id: ids.vendorA,
        name: `Vendor A renamed ${run}`,
        contactEmail: 'owner@a.test',
      });
      const other = await prisma.vendors.findUniqueOrThrow({
        where: { id: ids.vendorB },
      });
      expect(other.name).toBe(`Vendor B ${run}`);
    });

    it('status and currency stay platform-admin only → 400', async () => {
      await api('adminA', 'patch', '/api/vendor/profile')
        .send({ status: 'suspended' })
        .expect(400);
      await api('adminA', 'patch', '/api/vendor/profile')
        .send({ currency: 'USD' })
        .expect(400);
    });

    it('branch_manager and staff cannot edit it → 403 forbidden_role', async () => {
      for (const who of ['managerA1', 'staffA2']) {
        const res = await api(who, 'patch', '/api/vendor/profile')
          .send({ name: 'x' })
          .expect(403);
        expect(res.body.code).toBe('forbidden_role');
      }
    });

    it('customers and anonymous callers are rejected', async () => {
      await api(null, 'get', '/api/vendor/profile').expect(401);
      const res = await api('customer', 'get', '/api/vendor/profile').expect(
        403,
      );
      expect(res.body.code).toBe('not_staff');
    });
  });
});
