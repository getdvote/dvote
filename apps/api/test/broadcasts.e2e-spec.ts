import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { SUPABASE_JWKS } from '../src/auth/supabase-jwt.verifier';
import { PrismaService } from '../src/prisma/prisma.service';
import { BroadcastsService } from '../src/broadcasts/broadcasts';
import { GoogleWalletService } from '../src/wallet/google-wallet.service';
import { createTestSigner } from './helpers/test-auth';

describe('Segmented Wallet broadcasts (e2e)', () => {
  let app: INestApplication;
  let db: PrismaService;
  let service: BroadcastsService;
  const vendor = randomUUID(), other = randomUUID(), branch = randomUUID(), custom = randomUUID();
  const cards: string[] = [], users: string[] = [];
  const tokens: Record<string, string> = {};
  const google = { enabled: false, notifyCard: jest.fn(async () => ({ status: 'accepted', reason: null })), userChanged: jest.fn(), vendorChanged: jest.fn() };
  const call = (who: string, path = '', method: 'get' | 'post' | 'patch' = 'post') => request(app.getHttpServer())[method](`/api/vendor/broadcasts${path}`).set('Authorization', `Bearer ${tokens[who]}`);
  const message = (extra = {}) => ({ title: 'Free coffee this weekend', body: 'Use your points at our shop.', idempotencyKey: randomUUID(), ...extra });

  beforeAll(async () => {
    const signer = await createTestSigner();
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(SUPABASE_JWKS).useValue(signer.jwks).overrideProvider(GoogleWalletService).useValue(google).compile();
    app = module.createNestApplication(); configureApp(app); await app.init();
    db = app.get(PrismaService); service = app.get(BroadcastsService);
    // Tests process queued jobs explicitly; no real provider or timer is involved.
    jest.spyOn(service as any, 'kick').mockImplementation(() => {});
    google.enabled = true;
    await db.vendors.createMany({ data: [{ id: vendor, name: 'Broadcast test' }, { id: other, name: 'Other broadcast test' }] });
    await db.branches.create({ data: { id: branch, vendor_id: vendor, name: 'Test branch', address: 'Test', lat: 30, lng: 31 } });
    for (const [name, role, vendorId] of [['admin', 'vendor_admin', vendor], ['manager', 'branch_manager', vendor], ['viewer', 'viewer', vendor], ['other', 'vendor_admin', other]] as const) {
      const auth = randomUUID();
      await db.staff_users.create({ data: { vendor_id: vendorId, branch_id: role === 'branch_manager' ? branch : null, name, email: `${auth}@test.dvote`, role, auth_user_id: auth } });
      tokens[name] = await signer.sign(auth);
    }
    for (let i = 0; i < 4; i++) {
      const u = await db.users.create({ data: { name: `Broadcast ${i}`, status: i === 3 ? 'blocked' : 'active' } }); users.push(u.id);
      const c = await db.cards.create({ data: { user_id: u.id, vendor_id: vendor, google_object_id: i === 2 ? null : `test.card-${randomUUID()}`, balance: i === 0 ? 100 : 0 } }); cards.push(c.id);
    }
    await db.$executeRaw`INSERT INTO customer_segments(id,vendor_id,name,match,rules) VALUES(${custom}::uuid,${vendor}::uuid,'High points','all','[{"field":"points","op":"gte","value":50}]'::jsonb)`;
  });

  afterAll(async () => {
    await db.$executeRaw`DELETE FROM wallet_broadcast_recipients WHERE vendor_id IN (${vendor}::uuid,${other}::uuid)`;
    await db.$executeRaw`DELETE FROM wallet_broadcasts WHERE vendor_id IN (${vendor}::uuid,${other}::uuid)`;
    await db.$executeRaw`DELETE FROM customer_segments WHERE vendor_id=${vendor}::uuid`;
    await db.cards.deleteMany({ where: { vendor_id: { in: [vendor, other] } } });
    await db.users.deleteMany({ where: { id: { in: users } } });
    await db.staff_users.deleteMany({ where: { vendor_id: { in: [vendor, other] } } });
    await db.branches.deleteMany({ where: { vendor_id: vendor } });
    await db.vendors.deleteMany({ where: { id: { in: [vendor, other] } } });
    await app.close();
  });

  it('enforces roles and tenant isolation, and previews without sending', async () => {
    await call('manager', '/preview').send({}).expect(403);
    await call('viewer').send(message()).expect(403);
    expect((await call('other', '/preview').send({}).expect(201)).body.linked).toBe(0);
    expect((await call('admin', '/preview').send({ segment: 'new' }).expect(201)).body).toMatchObject({ matched: 3, linked: 2, unavailable: 1 });
    expect((await call('admin', '/preview').send({ branchId: branch }).expect(201)).body.matched).toBe(0);
    expect(google.notifyCard).not.toHaveBeenCalled();
  });

  it('snapshots custom segments, keeps retries idempotent, and records Google acceptance', async () => {
    const body = message({ customSegment: custom });
    const preview = await call('admin', '/preview').send({ customSegment: custom }).expect(201);
    expect(preview.body.linked).toBe(1);
    const sent = await call('admin').send(body).expect(201);
    expect((await call('admin').send(body).expect(201)).body.id).toBe(sent.body.id);
    await call('admin').send({ ...body, title: 'Different' }).expect(409);
    await call('other', '/preview').send({ customSegment: custom }).expect(404);
    // A later segment change must not add another recipient to this queued campaign.
    await db.$executeRaw`UPDATE customer_segments SET rules='[]'::jsonb WHERE id=${custom}::uuid`;
    await service.processPending();
    expect(google.notifyCard).toHaveBeenCalledTimes(1);
    const history = await call('admin', '', 'get').expect(200);
    expect(history.body[0]).toMatchObject({ id: sent.body.id, total: 1, accepted: 1, pending: 0 });
    expect((await call('other', '', 'get').expect(200)).body).toEqual([]);
  });

  it('caps each card at three notifications in a rolling day and never automatically repeats uncertain sends', async () => {
    for (let i = 0; i < 4; i++) {
      await call('admin').send(message()).expect(201);
      await service.processPending();
    }
    const rows = await db.$queryRaw<{ card_id: string; n: number }[]>`SELECT card_id,count(*)::int AS n FROM wallet_broadcast_recipients WHERE vendor_id=${vendor}::uuid AND status='accepted' GROUP BY card_id`;
    expect(rows.every(r => r.n === 3)).toBe(true);
    await db.$executeRaw`UPDATE wallet_broadcast_recipients SET attempted_at=now()-interval '25 hours' WHERE vendor_id=${vendor}::uuid`;
    google.notifyCard.mockRejectedValueOnce(new Error('Network disconnected after submit') as never);
    await call('admin').send(message()).expect(201);
    await service.processPending();
    const count = google.notifyCard.mock.calls.length;
    await service.processPending();
    expect(google.notifyCard.mock.calls.length).toBe(count);
    expect((await db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM wallet_broadcast_recipients WHERE vendor_id=${vendor}::uuid AND status='unknown'`)[0].n).toBe(1);
  });

  it('keeps nearby reminders off until enabled and validates message input', async () => {
    expect((await call('admin', '/nearby', 'get').expect(200)).body).toEqual({ enabled: false, locations: 1 });
    await call('admin', '/nearby', 'patch').send({ enabled: true }).expect(200);
    expect(google.vendorChanged).toHaveBeenCalledWith(vendor);
    await call('admin').send(message({ body: '<script>bad</script>' })).expect(400);
    await call('admin').send(message({ title: ' ' })).expect(400);
    google.enabled = false;
    await call('admin').send(message()).expect(503);
  });
});
