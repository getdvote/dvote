import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { SUPABASE_JWKS } from './../src/auth/supabase-jwt.verifier';
import { PrismaService } from './../src/prisma/prisma.service';
import { createTestSigner, type TestSigner } from './helpers/test-auth';

const run = randomUUID().slice(0, 8);
const ids = { vendorA: randomUUID(), vendorB: randomUUID(), suspended: randomUUID(), branchA: randomUUID(), branchB: randomUUID() };

describe('Public join (dvote.app/<slug>): venue page, join with the form, card page (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  const phones: string[] = [];
  const subs: string[] = [];
  const slugs = { a: '', b: '', suspended: '' };

  const http = () => request(app.getHttpServer());
  const join = (slug: string, body: Record<string, unknown>) => http().post(`/api/public/vendors/${slug}/join`).send(body);
  /** A fresh customer's form (a new random mobile each time). */
  const newForm = (over: Record<string, unknown> = {}) => {
    const digits = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
    phones.push(`+2010${digits}`);
    return { name: 'Mona Ali', phone: `010 ${digits.slice(0, 4)} ${digits.slice(4)}`, source: 'nfc', ...over };
  };

  beforeAll(async () => {
    signer = await createTestSigner();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(SUPABASE_JWKS).useValue(signer.jwks).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    // slugs come from the names (database trigger)
    const made = await Promise.all([
      prisma.vendors.create({ data: { id: ids.vendorA, name: `Join Cafe ${run}`, card_design: 3 } }),
      prisma.vendors.create({ data: { id: ids.vendorB, name: `Other Bakery ${run}` } }),
      prisma.vendors.create({ data: { id: ids.suspended, name: `Closed Shop ${run}`, status: 'suspended' } }),
    ]);
    [slugs.a, slugs.b, slugs.suspended] = made.map((v) => v.slug);
    await prisma.branches.createMany({
      data: [
        { id: ids.branchA, vendor_id: ids.vendorA, name: 'Smouha' },
        { id: ids.branchB, vendor_id: ids.vendorB, name: 'Zamalek' },
      ],
    });
    await prisma.point_rules.create({ data: { vendor_id: ids.vendorA, version: 1, spend_amount: 10, points_per_spend: 1 } });
    await prisma.rewards.create({ data: { vendor_id: ids.vendorA, name: 'Free coffee', name_ar: 'قهوة مجانية', points_cost: 300 } });
  });

  afterAll(async () => {
    const v = [ids.vendorA, ids.vendorB, ids.suspended];
    await prisma.cards.deleteMany({ where: { vendor_id: { in: v } } });
    await prisma.rewards.deleteMany({ where: { vendor_id: { in: v } } });
    await prisma.point_rules.deleteMany({ where: { vendor_id: { in: v } } });
    await prisma.branches.deleteMany({ where: { vendor_id: { in: v } } });
    await prisma.vendors.deleteMany({ where: { id: { in: v } } });
    await prisma.users.deleteMany({ where: { OR: [{ phone: { in: phones } }, { auth_user_id: { in: subs } }] } });
    await app.close();
  });

  it('a merchant gets its slug from its name', () => {
    expect(slugs.a).toBe(`join-cafe-${run}`);
    expect(slugs.b).toBe(`other-bakery-${run}`);
  });

  it('venue page: public data without sign-in; unknown or suspended → 404', async () => {
    const res = await http().get(`/api/public/vendors/${slugs.a.toUpperCase()}`).expect(200);
    expect(res.body).toMatchObject({
      id: ids.vendorA,
      slug: slugs.a,
      name: `Join Cafe ${run}`,
      cardDesign: 3,
      currency: 'EGP',
      rule: { spendAmount: '10.00', pointsPerSpend: 1 },
      rewards: [{ name: 'Free coffee', nameAr: 'قهوة مجانية', pointsCost: 300 }],
      branches: [{ id: ids.branchA, name: 'Smouha' }],
    });
    expect((await http().get('/api/public/vendors/no-such-shop').expect(404)).body.code).toBe('vendor_not_found');
    expect((await http().get(`/api/public/vendors/${slugs.suspended}`).expect(404)).body.code).toBe('vendor_not_found');
  });

  it('join with name + mobile (no sign-in): customer + card with balance 0 and a short code', async () => {
    const form = newForm({ branchId: ids.branchA, heardFrom: 'friend', source: 'qr' });
    const res = await join(slugs.a, form).expect(200);
    expect(res.body.created).toBe(true);
    expect(res.body.card).toMatchObject({ cardholder: 'Mona Ali', balance: 0, vendor: { id: ids.vendorA, slug: slugs.a, cardDesign: 3 } });
    expect(res.body.card.shortCode).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/);
    expect(res.body.card.publicId).toMatch(/^[0-9a-f]{32}$/);

    const card = await prisma.cards.findUniqueOrThrow({ where: { public_id: res.body.card.publicId }, include: { users: true } });
    expect(card).toMatchObject({ joined_via: 'qr', joined_branch_id: ids.branchA, heard_from: 'friend', balance: 0 });
    expect(card.users).toMatchObject({ name: 'Mona Ali', phone: phones.at(-1), email: null, auth_user_id: null });

    const page = await http().get(`/api/public/cards/${res.body.card.publicId}`).expect(200);
    expect(page.body).toEqual(res.body.card);
    expect((await http().get('/api/public/cards/0123456789abcdef0123456789abcdef').expect(404)).body.code).toBe('card_not_found');
    expect((await http().get(`/api/public/cards/${res.body.card.publicId}/wallet-status`).expect(200)).body).toEqual({ google: false, apple: false });
  });

  it('the same name + mobile (any case, spacing or phone format) = the same card; another merchant = a second card', async () => {
    const form = newForm();
    const first = await join(slugs.a, form).expect(200);
    const digits = (phones.at(-1) as string).slice(3);
    const back = await join(slugs.a, { name: '  mona   ALI ', phone: `+20 ${digits}`, source: 'link' }).expect(200);
    expect(back.body).toMatchObject({ created: false, card: { publicId: first.body.card.publicId, shortCode: first.body.card.shortCode } });

    const other = await join(slugs.b, { ...form, branchId: ids.branchB }).expect(200);
    expect(other.body.created).toBe(true);
    const cards = await prisma.cards.findMany({ where: { public_id: { in: [first.body.card.publicId, other.body.card.publicId] } } });
    expect(new Set(cards.map((c) => c.user_id)).size).toBe(1);
  });

  it('a known mobile with another name is refused (409 details_mismatch), nothing revealed', async () => {
    const form = newForm();
    await join(slugs.a, form).expect(200);
    const res = await join(slugs.a, { ...form, name: 'Someone Else' }).expect(409);
    expect(res.body.code).toBe('details_mismatch');
    expect(res.body.card).toBeUndefined();
  });

  it('rules: Egyptian mobile, a name, this merchant’s branch', async () => {
    expect((await join(slugs.a, newForm({ phone: '+971501234567' })).expect(400)).body.code).toBe('invalid_phone');
    expect((await join(slugs.a, newForm({ phone: '01301234567' })).expect(400)).body.code).toBe('invalid_phone');
    await join(slugs.a, newForm({ name: undefined })).expect(400);
    expect((await join(slugs.a, newForm({ name: '  a  ' })).expect(400)).body.code).toBe('name_required');
    await join(slugs.a, newForm({ source: 'carrier-pigeon' })).expect(400);
    expect((await join(slugs.a, newForm({ branchId: ids.branchB })).expect(400)).body.code).toBe('invalid_branch');
    expect((await join(slugs.suspended, newForm()).expect(404)).body.code).toBe('vendor_not_found');
  });

  it('a blocked customer can’t join; a web customer who gave an email and later signs into the app with it is the same customer', async () => {
    const email = `j-${randomUUID().slice(0, 8)}@test.dvote`;
    const form = newForm({ email });
    const joined = await join(slugs.a, form).expect(200);
    const webUser = (await prisma.cards.findUniqueOrThrow({ where: { public_id: joined.body.card.publicId } })).user_id;

    const sub = randomUUID();
    subs.push(sub);
    const token = await signer.sign(sub, {
      email,
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: 'Mona Ali' },
    });
    const me = await http().get('/api/app/users/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(me.body.id).toBe(webUser);

    await prisma.users.update({ where: { id: webUser }, data: { status: 'blocked' } });
    expect((await join(slugs.b, { name: form.name, phone: form.phone, source: 'link' }).expect(403)).body.code).toBe('user_blocked');
  });
});
