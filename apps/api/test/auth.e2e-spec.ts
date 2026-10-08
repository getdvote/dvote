import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type CryptoKey,
  type JWTPayload,
  SignJWT,
} from 'jose';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { SUPABASE_JWKS } from './../src/auth/supabase-jwt.verifier';
import { PrismaService } from './../src/prisma/prisma.service';

// Set by test/setup-env.ts.
const SUPABASE_URL = process.env.SUPABASE_URL!;
const KID = 'test-key';

describe('Customer auth + /api/app/users/me (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let privateKey: CryptoKey;
  let otherKey: CryptoKey;
  const createdAuthIds: string[] = [];

  /** Mints a token shaped like a Supabase access token. */
  async function token(
    overrides: JWTPayload & Record<string, unknown> = {},
    opts: { key?: CryptoKey; expiresIn?: string } = {},
  ): Promise<string> {
    const sub = (overrides.sub as string | undefined) ?? randomUUID();
    createdAuthIds.push(sub);
    return new SignJWT({
      role: 'authenticated',
      email: 'mona@example.com',
      is_anonymous: false,
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: {
        full_name: 'Mona Ali',
        avatar_url: 'https://example.com/a.png',
      },
      ...overrides,
    })
      .setProtectedHeader({ alg: 'ES256', kid: KID })
      .setSubject(sub)
      .setIssuer(
        (overrides.iss as string | undefined) ?? `${SUPABASE_URL}/auth/v1`,
      )
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime(opts.expiresIn ?? '1h')
      .sign(opts.key ?? privateKey);
  }

  const me = (t?: string) => {
    const req = request(app.getHttpServer()).get('/api/app/users/me');
    return t ? req.set('Authorization', `Bearer ${t}`) : req;
  };

  beforeAll(async () => {
    const pair = await generateKeyPair('ES256', { extractable: true });
    privateKey = pair.privateKey;
    otherKey = (await generateKeyPair('ES256')).privateKey;
    const jwk = {
      ...(await exportJWK(pair.publicKey)),
      kid: KID,
      alg: 'ES256',
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SUPABASE_JWKS)
      .useValue(createLocalJWKSet({ keys: [jwk] }))
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.users.deleteMany({
      where: { auth_user_id: { in: createdAuthIds } },
    });
    await app.close();
  });

  describe('rejected tokens', () => {
    it('no token → 401 missing_token', async () => {
      const res = await me().expect(401);
      expect(res.body.code).toBe('missing_token');
    });

    it('garbage token → 401 invalid_token', async () => {
      const res = await me('not-a-jwt').expect(401);
      expect(res.body.code).toBe('invalid_token');
    });

    it('signed by another key → 401 invalid_token', async () => {
      const res = await me(await token({}, { key: otherKey })).expect(401);
      expect(res.body.code).toBe('invalid_token');
    });

    it('wrong issuer (another Supabase project) → 401', async () => {
      const t = await token({ iss: 'https://other.supabase.co/auth/v1' });
      await me(t).expect(401);
    });

    it('expired → 401 token_expired', async () => {
      const res = await me(await token({}, { expiresIn: '-1m' })).expect(401);
      expect(res.body.code).toBe('token_expired');
    });

    it('phone (SMS) account → 403 provider_not_allowed', async () => {
      const t = await token({
        app_metadata: { provider: 'phone', providers: ['phone'] },
      });
      const res = await me(t).expect(403);
      expect(res.body.code).toBe('provider_not_allowed');
    });

    it('Apple (not enabled yet) → 403 provider_not_allowed', async () => {
      const t = await token({
        app_metadata: { provider: 'apple', providers: ['apple'] },
      });
      const res = await me(t).expect(403);
      expect(res.body.code).toBe('provider_not_allowed');
    });

    it('anonymous sign-in → 403 provider_not_allowed', async () => {
      await me(await token({ is_anonymous: true })).expect(403);
    });
  });

  describe('profile', () => {
    it('email + password sign-up: name comes from the sign-up form', async () => {
      const res = await me(
        await token({
          email: 'nour@example.com',
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: { full_name: 'Nour Adel', email_verified: true },
        }),
      ).expect(200);
      expect(res.body).toMatchObject({
        name: 'Nour Adel',
        email: 'nour@example.com',
        avatarUrl: null,
      });
    });

    it('first call creates the customer from the token, later calls reuse it', async () => {
      const sub = randomUUID();
      const first = await me(await token({ sub })).expect(200);
      expect(first.body).toMatchObject({
        name: 'Mona Ali',
        email: 'mona@example.com',
        avatarUrl: 'https://example.com/a.png',
        phone: null,
      });

      const second = await me(await token({ sub })).expect(200);
      expect(second.body.id).toBe(first.body.id);
      expect(await prisma.users.count({ where: { auth_user_id: sub } })).toBe(
        1,
      );
    });

    it('concurrent first calls create exactly one customer', async () => {
      const sub = randomUUID();
      const t = await token({ sub });
      const results = await Promise.all([me(t), me(t), me(t)]);
      results.forEach((r) => expect(r.status).toBe(200));
      expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    });

    it('Facebook account with no email and no name is accepted', async () => {
      const t = await token({
        email: undefined,
        app_metadata: { provider: 'facebook', providers: ['facebook'] },
        user_metadata: {},
      });
      const res = await me(t).expect(200);
      expect(res.body).toMatchObject({ name: null, email: null });
    });

    it('PATCH updates name and phone', async () => {
      const t = await token();
      const res = await request(app.getHttpServer())
        .patch('/api/app/users/me')
        .set('Authorization', `Bearer ${t}`)
        .send({ name: 'Mona A.', phone: '+201001234567' })
        .expect(200);
      expect(res.body).toMatchObject({
        name: 'Mona A.',
        phone: '+201001234567',
      });
    });

    it('PATCH rejects invalid and unknown fields', async () => {
      const t = await token();
      const patch = (body: object) =>
        request(app.getHttpServer())
          .patch('/api/app/users/me')
          .set('Authorization', `Bearer ${t}`)
          .send(body);
      await patch({ email: 'not-an-email' }).expect(400);
      await patch({ phone: '12' }).expect(400);
      await patch({ status: 'active' }).expect(400);
      await patch({ gender: 'robot' }).expect(400);
      for (const birthDate of [
        '2001-02-30', // not a real day
        '12/04/1995',
        '1899-12-31',
        new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10), // future
      ]) {
        await patch({ birthDate }).expect(400);
      }
    });

    it('PATCH sets gender and birthday, keeps the exact day, and null clears them', async () => {
      const sub = randomUUID();
      const t = await token({ sub });
      const patch = (body: object) =>
        request(app.getHttpServer())
          .patch('/api/app/users/me')
          .set('Authorization', `Bearer ${t}`)
          .send(body);

      const fresh = await me(t).expect(200);
      expect(fresh.body).toMatchObject({ gender: null, birthDate: null });

      const set = await patch({ gender: 'female', birthDate: '1995-01-01' }).expect(200);
      expect(set.body).toMatchObject({ gender: 'female', birthDate: '1995-01-01' });
      // stored as that calendar day, whatever the server's time zone
      const [row] = await prisma.$queryRaw<{ d: string }[]>`
        SELECT birth_date::text AS d FROM users WHERE auth_user_id = ${sub}::uuid`;
      expect(row.d).toBe('1995-01-01');
      expect((await me(t).expect(200)).body.birthDate).toBe('1995-01-01');

      // other fields alone leave them as they are
      const name = await patch({ name: 'Mona' }).expect(200);
      expect(name.body).toMatchObject({ gender: 'female', birthDate: '1995-01-01' });

      const cleared = await patch({ gender: null, birthDate: null }).expect(200);
      expect(cleared.body).toMatchObject({ gender: null, birthDate: null });
    });

    it('blocked customer → 403 user_blocked', async () => {
      const sub = randomUUID();
      await me(await token({ sub })).expect(200);
      await prisma.users.update({
        where: { auth_user_id: sub },
        data: { status: 'blocked' },
      });
      const res = await me(await token({ sub })).expect(403);
      expect(res.body.code).toBe('user_blocked');
    });
  });
});
