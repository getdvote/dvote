import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import './helpers/rate-limit-env'; // first: small limits, before the app reads its config

import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { SUPABASE_JWKS } from './../src/auth/supabase-jwt.verifier';
import { PrismaService } from './../src/prisma/prisma.service';
import { LIMITS } from './../src/rate-limit/rate-limit';
import { createTestSigner, type TestSigner } from './helpers/test-auth';

describe('Rate limiting: per user, per IP, stricter QR limit (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  const subs = [randomUUID(), randomUUID(), randomUUID()];
  const tokens: string[] = [];

  const me = (i: number) => request(app.getHttpServer()).get('/api/app/users/me').set('Authorization', `Bearer ${tokens[i]}`);

  beforeAll(async () => {
    signer = await createTestSigner();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(SUPABASE_JWKS).useValue(signer.jwks).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    for (const sub of subs) {
      tokens.push(
        await signer.sign(sub, {
          email: `rl-${sub.slice(0, 8)}@test.dvote`,
          app_metadata: { provider: 'google', providers: ['google'] },
          user_metadata: { full_name: 'Rate Limit' },
        }),
      );
    }
  });

  afterAll(async () => {
    const users = await prisma.users.findMany({ where: { auth_user_id: { in: subs } }, select: { id: true } });
    await prisma.qr_codes.deleteMany({ where: { user_id: { in: users.map((u) => u.id) } } });
    await prisma.users.deleteMany({ where: { auth_user_id: { in: subs } } });
    await app.close();
  });

  it('one user: the 6th request in a minute gets 429 rate_limited with Retry-After; another user is unaffected', async () => {
    for (let i = 0; i < 5; i++) await me(0).expect(200);
    const res = await me(0).expect(429);
    expect(res.body).toMatchObject({ code: 'rate_limited' });
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    await me(1).expect(200);
  });

  it('stricter endpoint limits are per user, on top of the default', async () => {
    expect(LIMITS.qrCreate).toBeGreaterThan(0);
    // The default user limit here (5) is lower than the QR limit (20): the QR route uses its own.
    let ok = 0;
    for (let i = 0; i < 7; i++) {
      const r = await request(app.getHttpServer()).post('/api/app/qr-codes').set('Authorization', `Bearer ${tokens[2]}`).send({ purpose: 'collect' });
      if (r.status === 201) ok++;
    }
    expect(ok).toBe(7);
  });

  it('one IP: every request counts, signed in or not', async () => {
    let limited = false;
    for (let i = 0; i < 45 && !limited; i++) {
      const r = await request(app.getHttpServer()).get('/api/health');
      limited = r.status === 429;
    }
    expect(limited).toBe(true);
  });
});
