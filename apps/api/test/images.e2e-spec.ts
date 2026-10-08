import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { SUPABASE_JWKS } from './../src/auth/supabase-jwt.verifier';
import type { staff_role } from './../src/generated/prisma/client.js';
import { PrismaService } from './../src/prisma/prisma.service';
import { MAX_BRANCH_PHOTOS } from './../src/vendor-images/vendor-images.service';
import { StorageService } from './../src/storage/storage.service';
import { FakeStorage } from './helpers/fake-storage';
import { createTestSigner, type TestSigner } from './helpers/test-auth';

const run = randomUUID().slice(0, 8);
const ids = {
  vendorA: randomUUID(),
  vendorB: randomUUID(),
  branchA1: randomUUID(),
  branchA2: randomUUID(),
  branchB1: randomUUID(),
};

describe('Images: customer photos, vendor logos, menu pages, branch photos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  const storage = new FakeStorage();
  const tokens: Record<string, string> = {};
  const customerSubs: string[] = [];
  const adminIds: string[] = [];
  let png: Buffer;

  const http = () => request(app.getHttpServer());
  const as = (who: string, method: 'get' | 'put' | 'post' | 'patch' | 'delete', path: string) =>
    http()[method](path).set('Authorization', `Bearer ${tokens[who]}`);
  /** Multipart upload of `file` (+ text fields). */
  const upload = (who: string, method: 'put' | 'post', path: string, file: Buffer, fields: Record<string, string> = {}) => {
    let req = as(who, method, path);
    for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
    return req.attach('file', file, 'photo.png');
  };

  async function seedStaff(key: string, vendorId: string, branchId: string | null, role: staff_role) {
    const authId = randomUUID();
    await prisma.staff_users.create({
      data: { vendor_id: vendorId, branch_id: branchId, name: key, email: `${key}-${run}@test.dvote`, role, auth_user_id: authId },
    });
    tokens[key] = await signer.sign(authId);
  }

  beforeAll(async () => {
    signer = await createTestSigner();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SUPABASE_JWKS)
      .useValue(signer.jwks)
      .overrideProvider(StorageService)
      .useValue(storage)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    // a real 1200x800 photo, so resizing and WebP conversion actually run
    png = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#c0392b' } }).png().toBuffer();

    await prisma.vendors.createMany({
      data: [
        { id: ids.vendorA, name: `Images A ${run}` },
        { id: ids.vendorB, name: `Images B ${run}` },
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
    await seedStaff('adminB', ids.vendorB, null, 'vendor_admin');

    const sub = randomUUID();
    customerSubs.push(sub);
    tokens.mona = await signer.sign(sub, {
      email: `mona-${run}@test.dvote`,
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: 'Mona', avatar_url: 'https://lh3.googleusercontent.com/mona.jpg' },
    });

    const adminAuth = randomUUID();
    const admin = await prisma.platform_admins.create({
      data: { name: 'Images admin', email: `admin-${run}@test.dvote`, auth_user_id: adminAuth },
    });
    adminIds.push(admin.id);
    tokens.platform = await signer.sign(adminAuth, { aal: 'aal2' });
  });

  afterAll(async () => {
    const vendorIds = [ids.vendorA, ids.vendorB];
    await prisma.vendor_images.deleteMany({ where: { vendor_id: { in: vendorIds } } });
    await prisma.staff_users.deleteMany({ where: { vendor_id: { in: vendorIds } } });
    await prisma.branches.deleteMany({ where: { vendor_id: { in: vendorIds } } });
    await prisma.vendors.deleteMany({ where: { id: { in: vendorIds } } });
    await prisma.users.deleteMany({ where: { auth_user_id: { in: customerSubs } } });
    await prisma.platform_admins.deleteMany({ where: { id: { in: adminIds } } });
    await app.close();
  });

  describe('customer photo (PUT/DELETE /api/app/users/me/avatar)', () => {
    it('starts with the sign-in provider photo', async () => {
      const res = await as('mona', 'get', '/api/app/users/me').expect(200);
      expect(res.body.avatarUrl).toBe('https://lh3.googleusercontent.com/mona.jpg');
    });

    it('upload → private bucket as a 512x512 WebP, returned as a signed link', async () => {
      const res = await upload('mona', 'put', '/api/app/users/me/avatar', png).expect(200);
      const user = await prisma.users.findFirstOrThrow({ where: { auth_user_id: customerSubs[0] } });
      expect(user.avatar_path).toMatch(new RegExp(`^${user.id}/[0-9a-f-]{36}\\.webp$`));
      expect(res.body.avatarUrl).toBe(`https://test-project.supabase.co/storage/v1/object/sign/avatars/${user.avatar_path}?token=test`);

      const file = storage.get('avatars', user.avatar_path!)!;
      expect(file.contentType).toBe('image/webp');
      expect(await sharp(file.data).metadata()).toMatchObject({ format: 'webp', width: 512, height: 512 });

      // GET /me signs it too
      const me = await as('mona', 'get', '/api/app/users/me').expect(200);
      expect(me.body.avatarUrl).toContain(`/sign/avatars/${user.avatar_path}`);
    });

    it('replacing the photo deletes the old file', async () => {
      const before = await prisma.users.findFirstOrThrow({ where: { auth_user_id: customerSubs[0] } });
      await upload('mona', 'put', '/api/app/users/me/avatar', png).expect(200);
      const after = await prisma.users.findFirstOrThrow({ where: { auth_user_id: customerSubs[0] } });
      expect(after.avatar_path).not.toBe(before.avatar_path);
      expect(storage.has('avatars', before.avatar_path!)).toBe(false);
      expect(storage.has('avatars', after.avatar_path!)).toBe(true);
      expect(storage.list('avatars', `${after.id}/`)).toHaveLength(1);
    });

    it('delete → file removed from storage, no photo at all', async () => {
      const user = await prisma.users.findFirstOrThrow({ where: { auth_user_id: customerSubs[0] } });
      const res = await as('mona', 'delete', '/api/app/users/me/avatar').expect(200);
      expect(res.body.avatarUrl).toBeNull();
      expect(storage.has('avatars', user.avatar_path!)).toBe(false);
      expect(await prisma.users.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({
        avatar_path: null,
        avatar_url: null,
      });
    });

    it('rejects a non-image (415), a missing file (400) and a too-big file (413)', async () => {
      const fake = await upload('mona', 'put', '/api/app/users/me/avatar', Buffer.from('not an image at all')).expect(415);
      expect(fake.body.code).toBe('unsupported_image');
      const none = await as('mona', 'put', '/api/app/users/me/avatar').expect(400);
      expect(none.body.code).toBe('file_required');
      const huge = await upload('mona', 'put', '/api/app/users/me/avatar', Buffer.alloc(11 * 1024 * 1024)).expect(413);
      expect(huge.body.code).toBe('file_too_large');
    });

    it('needs a customer token', async () => {
      await http().put('/api/app/users/me/avatar').attach('file', png, 'p.png').expect(401);
    });
  });

  describe('vendor logo (PUT/DELETE /api/vendor/profile/logo, /api/admin/vendors/{id}/logo)', () => {
    it('vendor admin uploads → public bucket, logoUrl is its public link', async () => {
      const res = await upload('adminA', 'put', '/api/vendor/profile/logo', png).expect(200);
      const vendor = await prisma.vendors.findUniqueOrThrow({ where: { id: ids.vendorA } });
      expect(vendor.logo_path).toMatch(new RegExp(`^${ids.vendorA}/logo/[0-9a-f-]{36}\\.webp$`));
      expect(res.body.logoUrl).toBe(`https://test-project.supabase.co/storage/v1/object/public/vendors/${vendor.logo_path}`);
      const meta = await sharp(storage.get('vendors', vendor.logo_path!)!.data).metadata();
      expect(meta).toMatchObject({ format: 'webp', width: 512 }); // fits in 512, not cropped
      expect(meta.height).toBeLessThan(512);
    });

    it('staff and branch managers cannot change the logo', async () => {
      for (const who of ['staffA1', 'managerA1']) {
        const res = await upload(who, 'put', '/api/vendor/profile/logo', png).expect(403);
        expect(res.body.code).toBe('forbidden_role');
      }
    });

    it('replacing deletes the old file; delete removes the file and clears logoUrl', async () => {
      const first = (await prisma.vendors.findUniqueOrThrow({ where: { id: ids.vendorA } })).logo_path!;
      await upload('adminA', 'put', '/api/vendor/profile/logo', png).expect(200);
      const second = (await prisma.vendors.findUniqueOrThrow({ where: { id: ids.vendorA } })).logo_path!;
      expect(storage.has('vendors', first)).toBe(false);
      expect(storage.list('vendors', `${ids.vendorA}/logo/`)).toEqual([second]);

      const res = await as('adminA', 'delete', '/api/vendor/profile/logo').expect(200);
      expect(res.body.logoUrl).toBeNull();
      expect(storage.list('vendors', `${ids.vendorA}/logo/`)).toEqual([]);
    });

    it('setting an external logoUrl (PATCH) deletes the uploaded file', async () => {
      await upload('adminA', 'put', '/api/vendor/profile/logo', png).expect(200);
      const res = await as('adminA', 'patch', '/api/vendor/profile')
        .send({ logoUrl: 'https://example.com/logo.png' })
        .expect(200);
      expect(res.body.logoUrl).toBe('https://example.com/logo.png');
      expect(storage.list('vendors', `${ids.vendorA}/logo/`)).toEqual([]);
      expect((await prisma.vendors.findUniqueOrThrow({ where: { id: ids.vendorA } })).logo_path).toBeNull();
    });

    it('platform admin can upload and remove any vendor logo', async () => {
      const res = await upload('platform', 'put', `/api/admin/vendors/${ids.vendorB}/logo`, png).expect(200);
      expect(res.body.logoUrl).toContain(`/public/vendors/${ids.vendorB}/logo/`);
      await as('platform', 'delete', `/api/admin/vendors/${ids.vendorB}/logo`).expect(200);
      expect(storage.list('vendors', `${ids.vendorB}/logo/`)).toEqual([]);
      await upload('platform', 'put', `/api/admin/vendors/${randomUUID()}/logo`, png).expect(404);
    });
  });

  describe('menu pages and branch photos (/api/vendor/images)', () => {
    it('vendor admin adds menu pages in order', async () => {
      const a = await upload('adminA', 'post', '/api/vendor/images', png, { kind: 'menu' }).expect(201);
      const b = await upload('adminA', 'post', '/api/vendor/images', png, { kind: 'menu' }).expect(201);
      expect(a.body).toMatchObject({ kind: 'menu', branchId: null, sortOrder: 0 });
      expect(b.body.sortOrder).toBe(1);
      expect(a.body.url).toMatch(new RegExp(`/public/vendors/${ids.vendorA}/menu/[0-9a-f-]{36}\\.webp$`));
      expect(storage.list('vendors', `${ids.vendorA}/menu/`)).toHaveLength(2);
    });

    it('branch photos: admin must name a branch of their own vendor', async () => {
      const missing = await upload('adminA', 'post', '/api/vendor/images', png, { kind: 'branch_photo' }).expect(400);
      expect(missing.body.code).toBe('branch_required');
      const foreign = await upload('adminA', 'post', '/api/vendor/images', png, { kind: 'branch_photo', branchId: ids.branchB1 }).expect(400);
      expect(foreign.body.code).toBe('invalid_branch');
      const ok = await upload('adminA', 'post', '/api/vendor/images', png, { kind: 'branch_photo', branchId: ids.branchA2 }).expect(201);
      expect(ok.body).toMatchObject({ kind: 'branch_photo', branchId: ids.branchA2 });
      expect(ok.body.url).toContain(`/vendors/${ids.vendorA}/branches/${ids.branchA2}/`);
    });

    it('branch manager: own branch photos only; staff: nothing', async () => {
      const own = await upload('managerA1', 'post', '/api/vendor/images', png, { kind: 'branch_photo' }).expect(201);
      expect(own.body.branchId).toBe(ids.branchA1);
      const other = await upload('managerA1', 'post', '/api/vendor/images', png, { kind: 'branch_photo', branchId: ids.branchA2 }).expect(403);
      expect(other.body.code).toBe('forbidden_branch');
      const menu = await upload('managerA1', 'post', '/api/vendor/images', png, { kind: 'menu' }).expect(403);
      expect(menu.body.code).toBe('forbidden_role');
      const staff = await upload('staffA1', 'post', '/api/vendor/images', png, { kind: 'branch_photo' }).expect(403);
      expect(staff.body.code).toBe('forbidden_role');
      await upload('adminA', 'post', '/api/vendor/images', png, { kind: 'menu', branchId: ids.branchA1 }).expect(400);
    });

    it('lists only the own vendor’s images, with filters', async () => {
      const all = await as('staffA1', 'get', '/api/vendor/images').expect(200);
      expect(all.body).toHaveLength(4); // 2 menu + A2 + A1
      const menu = await as('adminA', 'get', '/api/vendor/images?kind=menu').expect(200);
      expect(menu.body).toHaveLength(2);
      const a1 = await as('adminA', 'get', `/api/vendor/images?branchId=${ids.branchA1}`).expect(200);
      expect(a1.body).toHaveLength(1);
      const b = await as('adminB', 'get', '/api/vendor/images').expect(200);
      expect(b.body).toEqual([]);
    });

    it('delete removes the file and the row; others get 404', async () => {
      const [menuPage] = (await as('adminA', 'get', '/api/vendor/images?kind=menu').expect(200)).body as { id: string }[];
      const row = await prisma.vendor_images.findUniqueOrThrow({ where: { id: menuPage.id } });

      // another vendor, and a branch manager (menu is not theirs), can't see it
      expect((await as('adminB', 'delete', `/api/vendor/images/${row.id}`).expect(404)).body.code).toBe('image_not_found');
      await as('managerA1', 'delete', `/api/vendor/images/${row.id}`).expect(404);
      await as('staffA1', 'delete', `/api/vendor/images/${row.id}`).expect(403);
      expect(storage.has('vendors', row.storage_path)).toBe(true);

      await as('adminA', 'delete', `/api/vendor/images/${row.id}`).expect(204);
      expect(storage.has('vendors', row.storage_path)).toBe(false);
      expect(await prisma.vendor_images.findUnique({ where: { id: row.id } })).toBeNull();

      // the branch manager can delete their own branch's photo
      const [own] = (await as('managerA1', 'get', `/api/vendor/images?branchId=${ids.branchA1}`).expect(200)).body as { id: string }[];
      await as('managerA1', 'delete', `/api/vendor/images/${own.id}`).expect(204);
    });

    it(`at most ${MAX_BRANCH_PHOTOS} photos per branch → 409 too_many_images`, async () => {
      const existing = await prisma.vendor_images.count({ where: { branch_id: ids.branchA2 } });
      for (let i = existing; i < MAX_BRANCH_PHOTOS; i++) {
        await upload('adminA', 'post', '/api/vendor/images', png, { kind: 'branch_photo', branchId: ids.branchA2 }).expect(201);
      }
      const res = await upload('adminA', 'post', '/api/vendor/images', png, { kind: 'branch_photo', branchId: ids.branchA2 }).expect(409);
      expect(res.body.code).toBe('too_many_images');
      expect(storage.list('vendors', `${ids.vendorA}/branches/${ids.branchA2}/`)).toHaveLength(MAX_BRANCH_PHOTOS);
    });
  });
});
