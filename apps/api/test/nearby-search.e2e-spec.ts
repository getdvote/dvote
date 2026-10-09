import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { SUPABASE_JWKS } from './../src/auth/supabase-jwt.verifier';
import { PrismaService } from './../src/prisma/prisma.service';
import { createTestSigner } from './helpers/test-auth';

const run = randomUUID().slice(0, 8);
// Three shops around Alexandria: near (Smouha), mid (San Stefano), far (Cairo). Names carry the
// run id so other suites' shops never match the searches below.
const v = { near: randomUUID(), mid: randomUUID(), far: randomUUID(), noMap: randomUUID() };

describe('Explore search + shops near me (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token = '';
  const sub = randomUUID();

  const get = (path: string) => request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`);
  const names = (rows: { name: string }[]) => rows.map((r) => r.name).filter((n) => n.endsWith(run));

  beforeAll(async () => {
    const signer = await createTestSigner();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(SUPABASE_JWKS).useValue(signer.jwks).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.vendors.createMany({
      data: [
        { id: v.near, name: `Near Beans ${run}`, category: 'cafe' },
        { id: v.mid, name: `Mid Oven ${run}`, category: 'bakery' },
        { id: v.far, name: `Far Juice ${run}`, category: 'juice_bar' },
        { id: v.noMap, name: `Hidden Spot ${run}`, category: 'restaurant' },
      ],
    });
    await prisma.branches.createMany({
      data: [
        { vendor_id: v.near, name: 'Smouha', city: 'Alexandria', address: 'Fawzy Moaz St', lat: 31.2156, lng: 29.9553 },
        { vendor_id: v.mid, name: 'San Stefano', city: 'Alexandria', lat: 31.245, lng: 29.9667 },
        { vendor_id: v.mid, name: 'Far branch', city: 'Aswan', lat: 24.0889, lng: 32.8998 },
        { vendor_id: v.far, name: 'Zamalek', city: 'Cairo', lat: 30.0626, lng: 31.2197 },
        { vendor_id: v.noMap, name: 'No map', city: 'Alexandria' }, // no location: never "near"
      ],
    });
    await prisma.rewards.create({ data: { vendor_id: v.mid, name: 'Croissant Box', name_ar: 'علبة كرواسون', points_cost: 100 } });

    token = await signer.sign(sub, { email: `near-${run}@test.dvote`, app_metadata: { provider: 'google', providers: ['google'] } });
    await get('/api/app/users/me').expect(200);
  });

  afterAll(async () => {
    const ids = Object.values(v);
    await prisma.rewards.deleteMany({ where: { vendor_id: { in: ids } } });
    await prisma.branches.deleteMany({ where: { vendor_id: { in: ids } } });
    await prisma.vendors.deleteMany({ where: { id: { in: ids } } });
    await prisma.users.deleteMany({ where: { auth_user_id: sub } });
    await app.close();
  });

  it('search matches name, category (EN + AR), branch city / name / address, reward name (EN + AR)', async () => {
    const s = async (q: string) => names((await get(`/api/app/vendors?search=${encodeURIComponent(q)}`).expect(200)).body);
    expect(await s(`beans ${run}`)).toEqual([`Near Beans ${run}`]); // name
    expect(await s('bakery')).toEqual([`Mid Oven ${run}`]); // category
    expect(await s('مخبز')).toEqual([`Mid Oven ${run}`]); // category in Arabic
    expect(await s('juice')).toEqual([`Far Juice ${run}`]); // category word
    expect(await s('Aswan')).toEqual([`Mid Oven ${run}`]); // a branch city
    expect(await s('fawzy')).toEqual([`Near Beans ${run}`]); // a branch address
    expect(await s('croissant')).toEqual([`Mid Oven ${run}`]); // a reward
    expect(await s('كرواسون')).toEqual([`Mid Oven ${run}`]); // a reward in Arabic
    expect((await s('alexandria')).sort()).toEqual([`Hidden Spot ${run}`, `Mid Oven ${run}`, `Near Beans ${run}`]);
    expect(await s('zzzz-nothing')).toEqual([]);
  });

  it('nearby: unknown location first; then nearest first from my saved location; lat without lng → 400', async () => {
    expect((await get('/api/app/vendors/nearby').expect(200)).body).toEqual({ located: false, items: [] });

    // The app sends where I am (Smouha), then asks without coordinates: the saved one is used.
    await request(app.getHttpServer())
      .put('/api/app/users/me/location')
      .set('Authorization', `Bearer ${token}`)
      .send({ lat: 31.2157, lng: 29.9554 })
      .expect(204);
    const saved = await prisma.users.findFirstOrThrow({ where: { auth_user_id: sub } });
    expect(Number(saved.last_lat)).toBeCloseTo(31.2157, 4);
    expect(saved.last_location_at).not.toBeNull();

    type Near = { located: boolean; items: { name: string; distanceKm: number; nearestBranch: string }[] };
    const near = (await get('/api/app/vendors/nearby?limit=30').expect(200)).body as Near;
    expect(near.located).toBe(true);
    const mine = near.items.filter((i) => i.name.endsWith(run));
    expect(mine.map((i) => i.name)).toEqual([`Near Beans ${run}`, `Mid Oven ${run}`, `Far Juice ${run}`]); // no-map shop left out
    expect(mine[0]).toMatchObject({ nearestBranch: 'Smouha' });
    expect(mine[0].distanceKm).toBeLessThan(0.1);
    expect(mine[1]).toMatchObject({ nearestBranch: 'San Stefano' }); // its closest branch, not Aswan
    expect(mine[1].distanceKm).toBeGreaterThan(2);
    expect(mine[1].distanceKm).toBeLessThan(5);
    expect(mine[2].distanceKm).toBeGreaterThan(150); // Cairo

    // Coordinates sent now win over the saved ones (standing in Zamalek, Cairo).
    const cairo = ((await get('/api/app/vendors/nearby?lat=30.0626&lng=31.2197&limit=30').expect(200)).body as Near).items.filter((i) =>
      i.name.endsWith(run),
    );
    expect(cairo[0].name).toBe(`Far Juice ${run}`);

    await get('/api/app/vendors/nearby?lat=31.2').expect(400);
    await request(app.getHttpServer()).put('/api/app/users/me/location').set('Authorization', `Bearer ${token}`).send({ lat: 95, lng: 10 }).expect(400);
  });
});
