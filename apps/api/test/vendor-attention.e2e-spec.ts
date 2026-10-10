import { createHash, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { SUPABASE_JWKS } from './../src/auth/supabase-jwt.verifier';
import type { staff_role } from './../src/generated/prisma/client.js';
import { PrismaService } from './../src/prisma/prisma.service';
import { createTestSigner, type TestSigner } from './helpers/test-auth';

const run = randomUUID().slice(0, 8);
const ids = {
  vendorA: randomUUID(),
  branchA1: randomUUID(),
  branchA2: randomUUID(),
  user: randomUUID(),
  card: randomUUID(),
};

interface Item {
  key: string;
  group: 'now' | 'setup';
  tone: string;
  title: string;
  action: { to: string };
}

describe('Dashboard home: needs your attention (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let signer: TestSigner;
  const tokens: Record<string, string> = {};
  const staffIds: Record<string, string> = {};

  const attention = async (who: string) =>
    (
      (
        await request(app.getHttpServer())
          .get('/api/vendor/attention')
          .set('Authorization', `Bearer ${tokens[who]}`)
          .expect(200)
      ).body as { items: Item[] }
    ).items;
  const keys = (items: Item[]) => items.map((i) => i.key.split(':')[0]);

  async function seedStaff(
    key: string,
    branchId: string | null,
    role: staff_role,
  ) {
    const authId = randomUUID();
    const s = await prisma.staff_users.create({
      data: {
        vendor_id: ids.vendorA,
        branch_id: branchId,
        name: key,
        email: `${key}-${run}@test.dvote`,
        role,
        auth_user_id: authId,
      },
    });
    staffIds[key] = s.id;
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

    await prisma.vendors.create({
      data: { id: ids.vendorA, name: `Attention ${run}` },
    });
    await prisma.branches.createMany({
      data: [
        { id: ids.branchA1, vendor_id: ids.vendorA, name: 'A1' },
        {
          id: ids.branchA2,
          vendor_id: ids.vendorA,
          name: 'A2',
          lat: 31.2,
          lng: 29.9,
          weekly_hours: [{ day: 0, opensAt: '09:00', closesAt: '23:00' }],
        },
      ],
    });
    await seedStaff('adminA', null, 'vendor_admin');
    await seedStaff('managerA1', ids.branchA1, 'branch_manager');
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      // point_events is append-only (trigger): bypass triggers for test cleanup only.
      await tx.$executeRawUnsafe(
        'SET LOCAL session_replication_role = replica',
      );
      await tx.point_events.deleteMany({ where: { vendor_id: ids.vendorA } });
      await tx.qr_codes.deleteMany({ where: { user_id: ids.user } });
      await tx.cards.deleteMany({ where: { vendor_id: ids.vendorA } });
      await tx.users.deleteMany({ where: { id: ids.user } });
      await tx.reward_sold_outs.deleteMany({
        where: { vendor_id: ids.vendorA },
      });
      await tx.rewards.deleteMany({ where: { vendor_id: ids.vendorA } });
      await tx.point_rules.deleteMany({ where: { vendor_id: ids.vendorA } });
      await tx.staff_users.deleteMany({ where: { vendor_id: ids.vendorA } });
      await tx.branches.deleteMany({ where: { vendor_id: ids.vendorA } });
      await tx.vendors.deleteMany({ where: { id: ids.vendorA } });
    });
    await app.close();
  });

  it('a new merchant: critical items first, then setup (admin); a manager gets no setup items', async () => {
    const items = await attention('adminA');
    expect(keys(items)).toEqual([
      'no_active_rule',
      'no_active_rewards',
      'branches_no_hours',
      'branches_no_location',
      'profile_branding', // the manager counts as staff, so no "invite staff" item
    ]);
    expect(items[0]).toMatchObject({
      group: 'now',
      tone: 'critical',
      action: { to: '/rule' },
    });
    expect(items.find((i) => i.key === 'branches_no_hours')!.title).toBe(
      'A1 has no opening hours',
    );

    expect(keys(await attention('managerA1'))).toEqual([
      'no_active_rule',
      'no_active_rewards',
    ]);
  });

  it('once set up: rewards missing photo / Arabic, paused branch, sold out; a manager sees their branch only', async () => {
    const rule = await prisma.point_rules.create({
      data: {
        vendor_id: ids.vendorA,
        version: 1,
        spend_amount: 10,
        points_per_spend: 1,
      },
    });
    const cake = await prisma.rewards.create({
      data: { vendor_id: ids.vendorA, name: 'Cake', points_cost: 10 },
    });
    await prisma.rewards.create({
      data: {
        vendor_id: ids.vendorA,
        name: 'Coffee',
        name_ar: 'قهوة',
        image_url: 'https://img.test/c.webp',
        points_cost: 5,
      },
    });
    await prisma.branches.update({
      where: { id: ids.branchA2 },
      data: { paused_until: new Date(Date.now() + 3_600_000) },
    });
    await prisma.reward_sold_outs.create({
      data: {
        vendor_id: ids.vendorA,
        reward_id: cake.id,
        branch_id: ids.branchA1,
      },
    });

    const items = await attention('adminA');
    expect(keys(items)).toEqual(
      expect.arrayContaining([
        'branch_paused',
        'sold_out',
        'rewards_no_photo',
        'rewards_no_arabic',
      ]),
    );
    expect(keys(items)).not.toContain('no_active_rule');
    expect(items.find((i) => i.key.startsWith('rewards_no_photo'))!.title).toBe(
      '1 reward without a photo',
    );
    expect(items.find((i) => i.key.startsWith('sold_out'))!.title).toBe(
      '1 reward sold out at A1',
    );
    // "now" items come before setup ones.
    const firstSetup = items.findIndex((i) => i.group === 'setup');
    expect(items.slice(firstSetup).every((i) => i.group === 'setup')).toBe(
      true,
    );

    // The manager of A1: A1's sold-out, not A2's pause, no setup.
    expect(keys(await attention('managerA1'))).toEqual(['sold_out']);

    // Unusual: one card collecting 4 times today.
    await prisma.users.create({
      data: {
        id: ids.user,
        name: 'Mona',
        email: `mona-${run}@test.dvote`,
        auth_user_id: randomUUID(),
      },
    });
    await prisma.cards.create({
      data: {
        id: ids.card,
        user_id: ids.user,
        vendor_id: ids.vendorA,
        balance: 40,
        lifetime_points: 40,
      },
    });
    for (let i = 0; i < 4; i++) {
      const qr = await prisma.qr_codes.create({
        data: {
          user_id: ids.user,
          purpose: 'collect',
          token_hash: createHash('sha256').update(randomUUID()).digest('hex'),
          status: 'used',
          used_at: new Date(),
          used_by_staff_id: staffIds.managerA1,
          used_branch_id: ids.branchA1,
        },
      });
      await prisma.point_events.create({
        data: {
          card_id: ids.card,
          vendor_id: ids.vendorA,
          branch_id: ids.branchA1,
          staff_id: staffIds.managerA1,
          qr_code_id: qr.id,
          type: 'earn',
          delta: 10,
          purchase_amount: 100,
          rule_id: rule.id,
          idempotency_key: randomUUID(),
        },
      });
    }
    const spike = (await attention('managerA1')).find((i) =>
      i.key.startsWith('card_spike'),
    )!;
    expect(spike).toMatchObject({
      tone: 'warning',
      title: `Card #${ids.card.slice(0, 6).toUpperCase()} collected 4 times today`,
      action: { to: '/activity' },
    });
  });
});
