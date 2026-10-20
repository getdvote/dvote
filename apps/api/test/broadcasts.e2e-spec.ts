import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { SUPABASE_JWKS } from '../src/auth/supabase-jwt.verifier';
import { PrismaService } from '../src/prisma/prisma.service';
import { BroadcastsService } from '../src/broadcasts/broadcasts';
import {
  GoogleWalletService,
  WalletRequestError,
} from '../src/wallet/google-wallet.service';
import { createTestSigner } from './helpers/test-auth';

describe('Segmented Wallet broadcasts (e2e)', () => {
  let app: INestApplication;
  let db: PrismaService;
  let service: BroadcastsService;
  const vendor = randomUUID(),
    other = randomUUID(),
    branch = randomUUID(),
    custom = randomUUID();
  const cards: string[] = [],
    users: string[] = [];
  const tokens: Record<string, string> = {};
  const google = {
    enabled: false,
    notifyCard: jest.fn<
      ReturnType<GoogleWalletService['notifyCard']>,
      Parameters<GoogleWalletService['notifyCard']>
    >(async () => ({ status: 'accepted', reason: null })),
    userChanged: jest.fn(),
    vendorChanged: jest.fn(),
  };
  const call = (
    who: string,
    path = '',
    method: 'get' | 'post' | 'patch' = 'post',
  ) =>
    request(app.getHttpServer())
      [method](`/api/vendor/broadcasts${path}`)
      .set('Authorization', `Bearer ${tokens[who]}`);
  const message = (extra = {}) => ({
    title: 'Free coffee this weekend',
    body: 'Use your points at our shop.',
    idempotencyKey: randomUUID(),
    ...extra,
  });

  beforeAll(async () => {
    const signer = await createTestSigner();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SUPABASE_JWKS)
      .useValue(signer.jwks)
      .overrideProvider(GoogleWalletService)
      .useValue(google)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    service = app.get(BroadcastsService);
    // Tests process queued jobs explicitly; no real provider or timer is involved.
    jest.spyOn(service as any, 'kick').mockImplementation(() => {});
    google.enabled = true;
    await db.vendors.createMany({
      data: [
        { id: vendor, name: 'Broadcast test' },
        { id: other, name: 'Other broadcast test' },
      ],
    });
    await db.branches.create({
      data: {
        id: branch,
        vendor_id: vendor,
        name: 'Test branch',
        address: 'Test',
        lat: 30,
        lng: 31,
      },
    });
    for (const [name, role, vendorId] of [
      ['admin', 'vendor_admin', vendor],
      ['manager', 'branch_manager', vendor],
      ['viewer', 'viewer', vendor],
      ['other', 'vendor_admin', other],
    ] as const) {
      const auth = randomUUID();
      await db.staff_users.create({
        data: {
          vendor_id: vendorId,
          branch_id: role === 'branch_manager' ? branch : null,
          name,
          email: `${auth}@test.dvote`,
          role,
          auth_user_id: auth,
        },
      });
      tokens[name] = await signer.sign(auth);
    }
    for (let i = 0; i < 4; i++) {
      const u = await db.users.create({
        data: {
          name: `Broadcast ${i}`,
          status: i === 3 ? 'blocked' : 'active',
        },
      });
      users.push(u.id);
      const c = await db.cards.create({
        data: {
          user_id: u.id,
          vendor_id: vendor,
          google_object_id: i === 2 ? null : `test.card-${randomUUID()}`,
          balance: i === 0 ? 100 : 0,
        },
      });
      cards.push(c.id);
    }
    await db.$executeRaw`INSERT INTO customer_segments(id,vendor_id,name,match,rules) VALUES(${custom}::uuid,${vendor}::uuid,'High points','all','[{"field":"points","op":"gte","value":50}]'::jsonb)`;
  });

  afterAll(async () => {
    await db.$executeRaw`DELETE FROM wallet_campaigns WHERE vendor_id IN (${vendor}::uuid,${other}::uuid)`;
    await db.$executeRaw`DELETE FROM wallet_broadcast_recipients WHERE vendor_id IN (${vendor}::uuid,${other}::uuid)`;
    await db.$executeRaw`DELETE FROM wallet_broadcasts WHERE vendor_id IN (${vendor}::uuid,${other}::uuid)`;
    await db.$executeRaw`DELETE FROM customer_segments WHERE vendor_id=${vendor}::uuid`;
    await db.cards.deleteMany({
      where: { vendor_id: { in: [vendor, other] } },
    });
    await db.users.deleteMany({ where: { id: { in: users } } });
    await db.staff_users.deleteMany({
      where: { vendor_id: { in: [vendor, other] } },
    });
    await db.branches.deleteMany({ where: { vendor_id: vendor } });
    await db.vendors.deleteMany({ where: { id: { in: [vendor, other] } } });
    await app.close();
  });

  it('enforces roles and tenant isolation, and previews without sending', async () => {
    await call('manager', '/preview').send({}).expect(403);
    await call('viewer').send(message()).expect(403);
    expect(
      (await call('other', '/preview').send({}).expect(201)).body.linked,
    ).toBe(0);
    expect(
      (await call('admin', '/preview').send({ segment: 'new' }).expect(201))
        .body,
    ).toMatchObject({ matched: 3, linked: 2, unavailable: 1 });
    expect(
      (await call('admin', '/preview').send({ branchId: branch }).expect(201))
        .body.matched,
    ).toBe(0);
    expect(google.notifyCard).not.toHaveBeenCalled();
  });

  it('snapshots custom segments, keeps retries idempotent, and records Google acceptance', async () => {
    const body = message({ customSegment: custom });
    const preview = await call('admin', '/preview')
      .send({ customSegment: custom })
      .expect(201);
    expect(preview.body.linked).toBe(1);
    const sent = await call('admin').send(body).expect(201);
    expect((await call('admin').send(body).expect(201)).body.id).toBe(
      sent.body.id,
    );
    await call('admin')
      .send({ ...body, title: 'Different' })
      .expect(409);
    await call('other', '/preview').send({ customSegment: custom }).expect(404);
    // A later segment change must not add another recipient to this queued campaign.
    await db.$executeRaw`UPDATE customer_segments SET rules='[]'::jsonb WHERE id=${custom}::uuid`;
    await service.processPending(vendor);
    expect(google.notifyCard).toHaveBeenCalledTimes(1);
    const history = await call('admin', '', 'get').expect(200);
    expect(history.body[0]).toMatchObject({
      id: sent.body.id,
      total: 1,
      accepted: 1,
      pending: 0,
    });
    expect((await call('other', '', 'get').expect(200)).body).toEqual([]);
  });

  it('caps each card at three notifications in a rolling day and never automatically repeats uncertain sends', async () => {
    for (let i = 0; i < 4; i++) {
      await call('admin').send(message()).expect(201);
      await service.processPending(vendor);
    }
    const rows = await db.$queryRaw<
      { card_id: string; n: number }[]
    >`SELECT card_id,count(*)::int AS n FROM wallet_broadcast_recipients WHERE vendor_id=${vendor}::uuid AND status='accepted' GROUP BY card_id`;
    expect(rows.every((r) => r.n === 3)).toBe(true);
    await db.$executeRaw`UPDATE wallet_broadcast_recipients SET attempted_at=now()-interval '25 hours' WHERE vendor_id=${vendor}::uuid`;
    google.notifyCard.mockRejectedValueOnce(
      new Error('Network disconnected after submit') as never,
    );
    await call('admin').send(message()).expect(201);
    await service.processPending(vendor);
    const count = google.notifyCard.mock.calls.length;
    await service.processPending(vendor);
    expect(google.notifyCard.mock.calls.length).toBe(count);
    expect(
      (
        await db.$queryRaw<
          { n: number }[]
        >`SELECT count(*)::int AS n FROM wallet_broadcast_recipients WHERE vendor_id=${vendor}::uuid AND status='unknown'`
      )[0].n,
    ).toBe(1);
  });

  it('records definite Google rejections without reserving notification quota', async () => {
    await db.$executeRaw`UPDATE wallet_broadcast_recipients SET attempted_at=now()-interval '25 hours' WHERE vendor_id=${vendor}::uuid`;
    google.notifyCard.mockRejectedValueOnce(
      new WalletRequestError(
        'Google Wallet addMessage: HTTP 400 (invalidResource)',
        400,
      ) as never,
    );
    const sent = await call('admin').send(message()).expect(201);
    await service.processPending(vendor);
    const rows = await db.$queryRaw<
      { status: string; reason: string | null }[]
    >`SELECT status,reason FROM wallet_broadcast_recipients WHERE broadcast_id=${sent.body.id}::uuid`;
    expect(rows).toContainEqual({
      status: 'failed',
      reason: 'provider_http_400',
    });
    expect(rows.some((r) => r.status === 'unknown')).toBe(false);
  });

  it('persists drafts, validates content and schedules, isolates edits, and queues each occurrence once', async () => {
    await db.$executeRaw`UPDATE wallet_broadcast_recipients SET attempted_at=now()-interval '25 hours' WHERE vendor_id=${vendor}::uuid`;
    await db.$executeRaw`UPDATE wallet_broadcasts SET created_at=now()-interval '25 hours' WHERE vendor_id=${vendor}::uuid`;
    const draft = {
      name: 'Internal campaign',
      body: 'x'.repeat(2000),
      mode: 'draft',
    };
    const c = (await call('admin', '/campaigns').send(draft).expect(201)).body;
    await call('admin', '/campaigns')
      .send({ ...draft, body: 'x'.repeat(2001) })
      .expect(400);
    for (const bad of [{ body: 'Hi <b>there</b>' }, { name: 'Promo <script>' }])
      await call('admin', '/campaigns')
        .send({ ...draft, ...bad })
        .expect(400);
    await call('admin', '/campaigns')
      .send({ ...draft, mode: 'schedule', nextAt: '2020-01-01T00:00:00Z' })
      .expect(400);
    await call('admin', '/campaigns')
      .send({
        ...draft,
        mode: 'repeat',
        nextAt: new Date(Date.now() + 86400000).toISOString(),
      })
      .expect(400);
    await call('other', `/campaigns/${c.id}`, 'patch').send(draft).expect(404);
    await call('manager', '/campaigns', 'get').expect(403);
    const calls = google.notifyCard.mock.calls.length;
    await service.processPending(vendor);
    expect(google.notifyCard).toHaveBeenCalledTimes(calls);
    await call('admin', `/campaigns/${c.id}`, 'patch')
      .send({
        ...draft,
        mode: 'repeat',
        nextAt: new Date(Date.now() + 86400000).toISOString(),
        repeatDays: 7,
      })
      .expect(200);
    await db.$executeRaw`UPDATE wallet_campaigns SET next_at=now()-interval '1 minute' WHERE id=${c.id}::uuid`;
    await service.processPending(vendor);
    await service.processPending(vendor);
    const list = (await call('admin', '/campaigns', 'get').expect(200)).body;
    expect(list.find((x: any) => x.id === c.id)).toMatchObject({
      status: 'repeating',
      repeatDays: 7,
      accepted: 2,
    });
    expect(google.notifyCard).toHaveBeenCalledTimes(calls + 2);
    expect(google.notifyCard.mock.calls.at(-1)?.[2]).toBe('Broadcast test');
    expect(
      (await call('admin', '/quota', 'get').expect(200)).body.remaining,
    ).toBe(2);
    await call('admin', `/campaigns/${c.id}/cancel`).send({}).expect(201);
    expect(
      (await call('admin', '/campaigns', 'get').expect(200)).body.find(
        (x: any) => x.id === c.id,
      ).status,
    ).toBe('cancelled');
  });

  it('re-validates stored campaigns before queuing them', async () => {
    const id = randomUUID();
    const [{ actor: ctx }] = await db.$queryRaw<{ actor: unknown }[]>`
      SELECT actor FROM wallet_campaigns WHERE vendor_id=${vendor}::uuid LIMIT 1`;
    // Written around the API (older row or direct edit): markup the DTO would refuse.
    await db.$executeRaw`INSERT INTO wallet_campaigns(id,vendor_id,actor,name,body,audience,status,next_at)
      VALUES(${id}::uuid,${vendor}::uuid,${JSON.stringify(ctx)}::jsonb,'Stored','<img src=x>','{}'::jsonb,'scheduled',now()-interval '1 minute')`;
    const calls = google.notifyCard.mock.calls.length;
    await service.processPending(vendor);
    expect(google.notifyCard).toHaveBeenCalledTimes(calls);
    const [row] = await db.$queryRaw<{ status: string }[]>`
      SELECT status FROM wallet_campaigns WHERE id=${id}::uuid`;
    expect(row.status).toBe('failed');
    const queued = await db.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM wallet_broadcasts WHERE audience->>'campaignId'=${id}`;
    expect(queued[0].n).toBe(0);
  });

  it('validates nearby branches and reserves one notification slot', async () => {
    await call('admin', '/nearby', 'patch')
      .send({ enabled: true, branchIds: [randomUUID()] })
      .expect(400);
    await call('admin', '/nearby', 'patch')
      .send({ enabled: true, branchIds: [] })
      .expect(400);
    await call('admin', '/nearby', 'patch')
      .send({ enabled: true, branchIds: [branch] })
      .expect(200);
    expect(
      (await call('admin', '/nearby', 'get').expect(200)).body.branchIds,
    ).toEqual([branch]);
    expect(
      (await call('admin', '/quota', 'get').expect(200)).body.remaining,
    ).toBe(1);
    await call('admin', '/nearby', 'patch')
      .send({ enabled: false })
      .expect(200);
    await db.$executeRaw`UPDATE vendors SET wallet_nearby_branch_ids=NULL WHERE id=${vendor}::uuid`;
  });

  it('serializes campaign reservations and defers a due campaign when its allowance is full', async () => {
    const payload = {
      name: 'Queued coffee',
      body: 'Coffee is ready.',
      mode: 'schedule',
      nextAt: new Date(Date.now() + 86400000).toISOString(),
    };
    const ids: string[] = [];
    for (let i = 0; i < 3; i++)
      ids.push(
        (await call('admin', '/campaigns').send(payload).expect(201)).body.id,
      );
    await db.$executeRaw`UPDATE wallet_campaigns SET next_at=now()-interval '1 minute' WHERE vendor_id=${vendor}::uuid AND status='scheduled'`;
    await Promise.all([
      service.processPending(vendor),
      service.processPending(vendor),
    ]);
    const quota = (await call('admin', '/quota', 'get').expect(200)).body;
    expect(quota.remaining).toBe(0);
    const rows = (
      await call('admin', '/campaigns', 'get').expect(200)
    ).body.filter((c: any) => ids.includes(c.id));
    expect(rows.filter((c: any) => c.status === 'sent')).toHaveLength(2);
    expect(rows.filter((c: any) => c.status === 'scheduled')).toHaveLength(1);
    for (const id of ids) {
      const [count] = await db.$queryRaw<
        { n: number }[]
      >`SELECT count(*)::int AS n FROM wallet_broadcasts WHERE audience->>'campaignId'=${id}`;
      expect(count.n).toBeLessThanOrEqual(1);
    }
    await call('admin', '/campaigns')
      .send({ ...payload, mode: 'now' })
      .expect(409);
    for (const id of ids)
      await db.$executeRaw`UPDATE wallet_campaigns SET status='cancelled',next_at=NULL WHERE id=${id}::uuid`;
  });

  it('upserts an autosaved draft without duplicates and preserves composer settings', async () => {
    const id = randomUUID();
    const payload = {
      clientDraftId: id,
      name: 'Untitled campaign',
      body: 'An unfinished notification',
      mode: 'draft',
      draftMode: 'repeat',
      nextAt: new Date(Date.now() + 86400000).toISOString(),
      repeatDays: 7,
    };
    expect(
      (await call('admin', '/campaigns').send(payload).expect(201)).body.id,
    ).toBe(id);
    await call('admin', '/campaigns')
      .send({ ...payload, body: 'Edited before leaving' })
      .expect(201);
    await call('other', '/campaigns').send(payload).expect(404);
    const list = (
      await call('admin', '/campaigns', 'get').expect(200)
    ).body.filter((c: any) => c.id === id);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      body: 'Edited before leaving',
      status: 'draft',
      audience: {
        draftMode: 'repeat',
        draftNextAt: payload.nextAt,
        draftRepeatDays: 7,
      },
    });
    const [count] = await db.$queryRaw<
      { n: number }[]
    >`SELECT count(*)::int AS n FROM wallet_broadcasts WHERE audience->>'campaignId'=${id}`;
    expect(count.n).toBe(0);
  });

  it('keeps nearby reminders off until enabled and validates message input', async () => {
    expect(
      (await call('admin', '/nearby', 'get').expect(200)).body,
    ).toMatchObject({ enabled: false, locations: 1, branchIds: null });
    await call('admin', '/nearby', 'patch').send({ enabled: true }).expect(200);
    expect(google.vendorChanged).toHaveBeenCalledWith(vendor);
    await call('admin')
      .send(message({ body: '<script>bad</script>' }))
      .expect(400);
    await call('admin')
      .send(message({ title: ' ' }))
      .expect(400);
    google.enabled = false;
    await call('admin').send(message()).expect(503);
  });
});
