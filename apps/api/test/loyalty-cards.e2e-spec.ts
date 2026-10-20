import { createHash, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { SUPABASE_JWKS } from './../src/auth/supabase-jwt.verifier';
import type { staff_role } from './../src/generated/prisma/client.js';
import { defaultDesign } from './../src/loyalty-cards/card-design';
import { PrismaService } from './../src/prisma/prisma.service';
import { createTestSigner, type TestSigner } from './helpers/test-auth';

const run = randomUUID().slice(0, 8);
const ids = { vendor: randomUUID(), other: randomUUID(), branch: randomUUID(), user: randomUUID(), card: randomUUID() };
const slug = `cards-${run}`;
const secret = 'A'.repeat(11) + run.replace(/-/g, '').slice(0, 8) + 'xyz';
const walletCode = `dvote:c1:${secret}`;

describe('Loyalty card: /api/vendor/loyalty-card (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  const tokens: Record<string, string> = {};

  const api = (who: string, method: 'get' | 'post' | 'patch', path = '') =>
    request(app.getHttpServer())[method](`/api/vendor/loyalty-card${path}`).set('Authorization', `Bearer ${tokens[who]}`);
  const design = (bg = '#2048AC') => defaultDesign('Joy rewards', bg);
  const join = (phone: string) =>
    request(app.getHttpServer()).post(`/api/public/vendors/${slug}/join`).send({ name: 'New Person', phone, source: 'qr' });
  const scan = () =>
    request(app.getHttpServer())
      .post('/api/vendor/scans/preview')
      .set('Authorization', `Bearer ${tokens.cashier}`)
      .send({ code: walletCode });

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
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.vendors.createMany({ data: [{ id: ids.vendor, name: `Cards ${run}`, slug }, { id: ids.other, name: `Other ${run}` }] });
    await prisma.branches.create({ data: { id: ids.branch, vendor_id: ids.vendor, name: 'Main', lat: 30.05, lng: 31.24 } });
    await seedStaff('admin', ids.vendor, null, 'vendor_admin');
    await seedStaff('viewer', ids.vendor, null, 'viewer');
    await seedStaff('cashier', ids.vendor, ids.branch, 'staff');
    await seedStaff('otherAdmin', ids.other, null, 'vendor_admin');
    await prisma.users.create({ data: { id: ids.user, name: 'Member', phone: `+2010${run.replace(/\D/g, '').padEnd(8, '1').slice(0, 8)}` } });
    await prisma.cards.create({
      data: { id: ids.card, user_id: ids.user, vendor_id: ids.vendor, short_code: 'MEM-BER', token_hash: createHash('sha256').update(secret).digest('hex') },
    });
  });

  afterAll(async () => {
    const v = [ids.vendor, ids.other];
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
      await tx.loyalty_card_versions.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.loyalty_cards.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.point_events.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.cards.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.users.deleteMany({ where: { OR: [{ id: ids.user }, { name: 'New Person', phone: { startsWith: '+20111' } }] } });
      await tx.point_rules.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.staff_users.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.branches.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.vendors.deleteMany({ where: { id: { in: v } } });
    });
    await app.close();
  });

  it('starts empty, and only the merchant admin can create', async () => {
    const r = (await api('admin', 'get').expect(200)).body;
    expect(r).toMatchObject({ card: null, design: null, versions: [], canCreate: true, counts: { members: 1 } });
    await api('viewer', 'post').send({ name: 'X', spendAmount: 10, design: design() }).expect(403);
  });

  it('the funnel creates the card, V1 live, and a 1-point rule', async () => {
    const r = (await api('admin', 'post').send({ name: 'Joy rewards', spendAmount: 10, design: design() }).expect(201)).body;
    expect(r.card).toMatchObject({ name: 'Joy rewards', status: 'active' });
    expect(r.versions).toEqual([expect.objectContaining({ number: 1, live: true, createdBy: 'admin' })]);
    expect(r.rule).toEqual({ spendAmount: '10.00', pointsPerSpend: 1 });
    expect(r.canCreate).toBe(false);
  });

  it('a second card is refused', async () => {
    const r = await api('admin', 'post').send({ name: 'Again', spendAmount: 5, design: design() }).expect(409);
    expect(r.body.code).toBe('card_exists');
  });

  it('settings change the name and publish a new rule version', async () => {
    const r = (await api('admin', 'patch', '/settings').send({ name: 'Joy club', spendAmount: 25.5 }).expect(200)).body;
    expect(r.card.name).toBe('Joy club');
    expect(r.rule).toEqual({ spendAmount: '25.50', pointsPerSpend: 1 });
    expect(await prisma.point_rules.count({ where: { vendor_id: ids.vendor } })).toBe(2);
  });

  it('saves versions and moves the live one back and forward without making new ones', async () => {
    await api('admin', 'post', '/versions').send({ design: design('#112233') }).expect(201);
    const v3 = (await api('admin', 'post', '/versions').send({ design: design('#445566') }).expect(201)).body;
    expect(v3.versions.map((v: { number: number }) => v.number)).toEqual([3, 2, 1]);
    const v1 = v3.versions.find((v: { number: number }) => v.number === 1);
    const back = (await api('admin', 'post', `/versions/${v1.id}/live`).expect(200)).body;
    expect(back.design.colors.background).toBe('#2048AC');
    expect(back.versions).toHaveLength(3);
    const forward = (await api('admin', 'post', `/versions/${v3.versions[0].id}/live`).expect(200)).body;
    expect(forward.design.colors.background).toBe('#445566');
  });

  it('rejects a bad design, a foreign background image and another merchant’s version', async () => {
    expect((await api('admin', 'post', '/versions').send({ design: { ...design(), colors: { background: 'red' } } }).expect(400)).body.code).toBe('invalid_design');
    const foreign = { ...design(), background: { style: 'solid', imagePath: `${ids.other}/card/x.webp`, imageUrl: null } };
    await api('admin', 'post', '/versions').send({ design: foreign }).expect(403);
    const mine = (await api('admin', 'get').expect(200)).body.versions[0].id;
    await api('otherAdmin', 'post', `/versions/${mine}/live`).expect(404);
  });

  it('directions must point at one of the merchant’s branches', async () => {
    const d = design();
    d.buttons.secondary = { type: 'directions', branchId: randomUUID() };
    expect((await api('admin', 'post', '/versions').send({ design: d }).expect(409)).body.code).toBe('invalid_branch');
    d.buttons.secondary = { type: 'directions', branchId: ids.branch };
    await api('admin', 'post', '/versions').send({ design: d }).expect(201);
  });

  it('the public pages get the card look', async () => {
    const r = (await request(app.getHttpServer()).get(`/api/public/vendors/${slug}`).expect(200)).body;
    expect(r.card).toMatchObject({ status: 'active', title: { en: 'Joy rewards' }, pointsLabel: { en: 'Points', ar: 'النقاط' } });
  });

  it('pause stops new sign-ups only: members still get their card and scan', async () => {
    await api('admin', 'post', '/pause').expect(200);
    expect((await join('01112345678').expect(409)).body.code).toBe('card_paused');
    const member = await prisma.users.findUniqueOrThrow({ where: { id: ids.user } });
    expect((await join(member.phone!.replace('+20', '0')).expect(200)).body.created).toBe(false);
    expect((await scan().expect(200)).body).toBeTruthy();
    await api('admin', 'post', '/resume').expect(200);
    expect((await join('01112345678').expect(200)).body.created).toBe(true);
  });

  it('cancel stops sign-ups and scans; restore brings it back', async () => {
    const r = (await api('admin', 'post', '/cancel').expect(200)).body;
    expect(r.card.status).toBe('cancelled');
    expect(new Date(r.card.restorableUntil).getTime() - new Date(r.card.cancelledAt).getTime()).toBe(30 * 86_400_000);
    expect(r.canCreate).toBe(false);
    expect((await join('01112345679').expect(409)).body.code).toBe('card_cancelled');
    expect((await scan().expect(403)).body.code).toBe('card_cancelled');
    await api('admin', 'post').send({ name: 'Fresh', spendAmount: 10, design: design() }).expect(409);
    expect((await api('admin', 'post', '/restore').expect(200)).body.card.status).toBe('active');
    await scan().expect(200);
  });

  it('after 30 days a cancelled card can’t be restored, and a new one can be made', async () => {
    await api('admin', 'post', '/cancel').expect(200);
    await prisma.loyalty_cards.update({ where: { vendor_id: ids.vendor }, data: { cancelled_at: new Date(Date.now() - 31 * 86_400_000) } });
    expect((await api('admin', 'post', '/restore').expect(409)).body.code).toBe('restore_expired');
    const r = (await api('admin', 'post').send({ name: 'Fresh', spendAmount: 10, design: design() }).expect(201)).body;
    expect(r.card).toMatchObject({ name: 'Fresh', status: 'active', cancelledAt: null });
    expect(r.versions[0]).toMatchObject({ live: true });
    expect(r.versions.length).toBeGreaterThan(4);
  });

  it('members: the merchant’s customer cards, searchable', async () => {
    const all = (await api('viewer', 'get', '/members').expect(200)).body;
    expect(all.total).toBe(2);
    const found = (await api('admin', 'get', '/members?search=member').expect(200)).body;
    expect(found.items).toEqual([expect.objectContaining({ name: 'Member', code: 'MEM-BER', points: 0 })]);
  });
});
