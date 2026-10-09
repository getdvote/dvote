import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { WebSocket } from 'ws';

import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { SUPABASE_JWKS } from './../src/auth/supabase-jwt.verifier';
import { PrismaService } from './../src/prisma/prisma.service';
import { createTestSigner, type TestSigner } from './helpers/test-auth';

const run = randomUUID().slice(0, 8);
const ids = { vendorA: randomUUID(), vendorB: randomUUID(), branchA: randomUUID() };

/** A test WebSocket client that collects the messages it receives. */
async function connect(port: number) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/api/app/live`);
  const messages: { type: string; vendorId?: string | null }[] = [];
  let closed: { code: number; reason: string } | null = null;
  ws.on('message', (m) => messages.push(JSON.parse(m.toString())));
  ws.on('close', (code, reason) => (closed = { code, reason: reason.toString() }));
  await new Promise((resolve, reject) => ws.once('open', resolve).once('error', reject));
  const waitFor = async (pred: () => boolean, ms = 3000) => {
    const end = Date.now() + ms;
    while (!pred() && Date.now() < end) await new Promise((r) => setTimeout(r, 20));
    return pred();
  };
  return { ws, messages, closed: () => closed, waitFor };
}

describe('Live updates to the customer app (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  let port = 0;
  const tokens: Record<string, string> = {};

  const as = (who: string, method: 'get' | 'post' | 'patch', path: string) =>
    request(app.getHttpServer())[method](path).set('Authorization', `Bearer ${tokens[who]}`);

  beforeAll(async () => {
    signer = await createTestSigner();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(SUPABASE_JWKS).useValue(signer.jwks).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    port = (app.getHttpServer().address() as AddressInfo).port;
    prisma = app.get(PrismaService);

    await prisma.vendors.createMany({ data: [{ id: ids.vendorA, name: `Live A ${run}` }, { id: ids.vendorB, name: `Live B ${run}` }] });
    await prisma.branches.create({ data: { id: ids.branchA, vendor_id: ids.vendorA, name: 'A1' } });
    await prisma.point_rules.create({ data: { vendor_id: ids.vendorA, version: 1, spend_amount: 10, points_per_spend: 1 } });

    const adminAuth = randomUUID();
    await prisma.staff_users.create({ data: { vendor_id: ids.vendorA, name: 'adminA', email: `live-admin-${run}@test.dvote`, role: 'vendor_admin', auth_user_id: adminAuth } });
    tokens.adminA = await signer.sign(adminAuth);
    for (const key of ['mona', 'omar']) {
      tokens[key] = await signer.sign(randomUUID(), {
        email: `${key}-${run}@test.dvote`,
        app_metadata: { provider: 'google', providers: ['google'] },
      });
      await as(key, 'get', '/api/app/users/me').expect(200); // creates the customer
    }
  });

  afterAll(async () => {
    const v = [ids.vendorA, ids.vendorB];
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
      await tx.point_events.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.cards.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.qr_codes.deleteMany({ where: { users: { email: { endsWith: `-${run}@test.dvote` } } } });
      await tx.point_rules.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.staff_users.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.branches.deleteMany({ where: { vendor_id: { in: v } } });
      await tx.vendors.deleteMany({ where: { id: { in: v } } });
      await tx.users.deleteMany({ where: { email: { endsWith: `-${run}@test.dvote` } } });
    });
    await app.close();
  });

  it('a signed-in app hears about dashboard changes at once (with the shop id)', async () => {
    const c = await connect(port);
    c.ws.send(JSON.stringify({ type: 'auth', token: tokens.mona }));
    expect(await c.waitFor(() => c.messages.some((m) => m.type === 'ready'))).toBe(true);

    await as('adminA', 'patch', '/api/vendor/profile').send({ category: 'cafe' }).expect(200);
    expect(await c.waitFor(() => c.messages.some((m) => m.type === 'vendor'))).toBe(true);
    expect(c.messages.find((m) => m.type === 'vendor')).toEqual({ type: 'vendor', vendorId: ids.vendorA });

    // Reads don't notify anyone.
    const before = c.messages.length;
    await as('adminA', 'get', '/api/vendor/profile').expect(200);
    await new Promise((r) => setTimeout(r, 150));
    expect(c.messages.length).toBe(before);
    c.ws.close();
  });

  it('points added at the counter: only that customer is told', async () => {
    const mona = await connect(port);
    const omar = await connect(port);
    mona.ws.send(JSON.stringify({ type: 'auth', token: tokens.mona }));
    omar.ws.send(JSON.stringify({ type: 'auth', token: tokens.omar }));
    await mona.waitFor(() => mona.messages.some((m) => m.type === 'ready'));
    await omar.waitFor(() => omar.messages.some((m) => m.type === 'ready'));

    const qr = (await as('mona', 'post', '/api/app/qr-codes').send({ purpose: 'collect' }).expect(201)).body as { code: string };
    await as('adminA', 'post', '/api/vendor/scans/collect')
      .send({ code: qr.code, amount: 50, branchId: ids.branchA, idempotencyKey: randomUUID() })
      .expect(200);

    expect(await mona.waitFor(() => mona.messages.some((m) => m.type === 'cards'))).toBe(true);
    await new Promise((r) => setTimeout(r, 150));
    expect(omar.messages.filter((m) => m.type !== 'ready')).toEqual([]); // a scan is not a shop change either
    mona.ws.close();
    omar.ws.close();
  });

  it('a bad token is refused and the socket closed; no token in time = closed too', async () => {
    const c = await connect(port);
    c.ws.send(JSON.stringify({ type: 'auth', token: 'not-a-jwt' }));
    expect(await c.waitFor(() => c.closed() !== null)).toBe(true);
    expect(c.closed()).toEqual({ code: 4401, reason: 'invalid_token' });

    // A staff token is not a customer token.
    const s = await connect(port);
    s.ws.send(JSON.stringify({ type: 'auth', token: tokens.adminA }));
    expect(await s.waitFor(() => s.closed() !== null)).toBe(true);
    expect(s.closed()?.code).toBe(4401);
  });
});
