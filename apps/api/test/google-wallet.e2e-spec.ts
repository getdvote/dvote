import { walletPublicKey } from './helpers/google-wallet-env';
import { createHash, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { jwtVerify } from 'jose';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';
import { GoogleWalletService } from '../src/wallet/google-wallet.service';
import { LiveService } from '../src/live/live.service';
import { StorageService } from '../src/storage/storage.service';
import { FakeStorage } from './helpers/fake-storage';
import sharp from 'sharp';

const ISSUER = '3388000000099999999';
const vendorId = randomUUID();
const email = `gw-${randomUUID().slice(0, 8)}@test.dvote`;

describe('Add to Google Wallet (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let publicId = '';
  let fetchMock: jest.SpyInstance;
  let failure = 0;
  let duringObjectPatch: (() => Promise<void>) | undefined;
  let requests: { url: string; body: any }[] = [];
  const storage = new FakeStorage();
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const target = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      if (target === 'https://oauth2.googleapis.com/token') return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }));
      if (init?.method === 'PATCH') {
        const body = JSON.parse(init.body as string);
        requests.push({ url: target, body });
        // Google requires underReview when editing an already approved class.
        if (target.includes('/loyaltyClass/') && body.reviewStatus !== 'UNDER_REVIEW') {
          return new Response(JSON.stringify({ error: { errors: [{ reason: 'invalidResource' }] } }), { status: 400 });
        }
        if (target.includes('/loyaltyObject/') && duringObjectPatch) {
          const change = duringObjectPatch;
          duringObjectPatch = undefined;
          await change();
        }
        return new Response('{}', { status: failure || 200 });
      }
      throw new Error('Unexpected HTTP request in wallet test');
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(StorageService).useValue(storage).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const v = await prisma.vendors.create({ data: { id: vendorId, name: `Wallet Cafe ${vendorId.slice(0, 6)}`, card_design: 3, logo_url: 'https://example.com/logo.png' } });
    const res = await http().post(`/api/public/vendors/${v.slug}/join`).send({ name: 'Mona Ali', email, phone: '01001234567', ageConfirmed: true, source: 'nfc' }).expect(200);
    publicId = res.body.card.publicId;
  });

  afterAll(async () => {
    await app.get(GoogleWalletService).onModuleDestroy();
    await prisma.cards.deleteMany({ where: { vendor_id: vendorId } });
    await prisma.vendors.deleteMany({ where: { id: vendorId } });
    await prisma.users.deleteMany({ where: { email } });
    await app.close();
    fetchMock.mockRestore();
  });

  it('returns a signed save link with the merchant class and the card object; saves the QR hash', async () => {
    const res = await http().get(`/api/public/cards/${publicId}/google-wallet`).expect(200);
    expect(res.body.saveUrl).toMatch(/^https:\/\/pay\.google\.com\/gp\/v\/save\//);
    const jwt = (res.body.saveUrl as string).split('/').pop() as string;
    const { payload } = await jwtVerify(jwt, walletPublicKey, { issuer: 'wallet@test.iam.gserviceaccount.com', audience: 'google' });
    const p = payload as unknown as { typ: string; payload: { loyaltyClasses: Record<string, any>[]; loyaltyObjects: Record<string, any>[] } };
    expect(p.typ).toBe('savetowallet');
    expect(p.payload.loyaltyClasses[0]).toMatchObject({ id: `${ISSUER}.vendor-${vendorId}`, hexBackgroundColor: '#2F6BDE', programLogo: { sourceUri: { uri: 'https://example.com/logo.png' } } });
    const obj = p.payload.loyaltyObjects[0];
    expect(obj).toMatchObject({ id: `${ISSUER}.card-${publicId}`, accountName: 'Mona Ali', loyaltyPoints: { balance: { int: 0 } }, barcode: { type: 'QR_CODE' } });
    expect(obj.barcode.value).toMatch(/^dvote:c1:[A-Za-z0-9_-]{22}$/);

    const card = await prisma.cards.findUniqueOrThrow({ where: { public_id: publicId } });
    const secret = (obj.barcode.value as string).slice('dvote:c1:'.length);
    expect(card.token_hash).toBe(createHash('sha256').update(secret).digest('hex'));
    expect(card.google_object_id).toBe(obj.id);

    // the same card gets the same QR next time
    const again = await http().get(`/api/public/cards/${publicId}/google-wallet`).expect(200);
    const { payload: p2 } = await jwtVerify((again.body.saveUrl as string).split('/').pop() as string, walletPublicKey);
    expect((p2 as any).payload.loyaltyObjects[0].barcode.value).toBe(obj.barcode.value);
  });

  it('does not mark a newer points change synchronized while an older snapshot is in flight', async () => {
    const wallet = app.get(GoogleWalletService);
    await prisma.cards.update({ where: { public_id: publicId }, data: { balance: 10, pass_updated_at: null } });
    duringObjectPatch = async () => {
      await prisma.cards.update({ where: { public_id: publicId }, data: { balance: 20 } });
    };
    await wallet.reconcile();
    expect((await prisma.cards.findUniqueOrThrow({ where: { public_id: publicId } })).pass_updated_at).toBeNull();
    requests = [];
    await wallet.reconcile();
    expect(requests.some(r => r.body.loyaltyPoints?.balance.int === 20)).toBe(true);
    expect((await prisma.cards.findUniqueOrThrow({ where: { public_id: publicId } })).pass_updated_at).not.toBeNull();
  });

  it('converts an older uploaded logo and points Google to the square derivative', async () => {
    const path = `${vendorId}/logo/${randomUUID()}.webp`;
    const input = await sharp({ create: { width: 120, height: 240, channels: 3, background: '#123c24' } }).webp().toBuffer();
    await storage.upload('vendors', path, input, 'image/webp');
    await prisma.vendors.update({ where: { id: vendorId }, data: { logo_path: path, logo_url: storage.publicUrl('vendors', path) } });
    requests = [];
    await app.get(GoogleWalletService).reconcile(true);
    const derivative = path.replace('.webp', '-wallet-v1.webp');
    expect(await sharp(storage.get('vendors', derivative)!.data).metadata()).toMatchObject({ width: 720, height: 720 });
    expect(requests.some(r => r.body.programLogo?.sourceUri.uri === storage.publicUrl('vendors', derivative))).toBe(true);
    expect(storage.get('vendors', path)!.data).toEqual(input);
  });

  it('unknown card → 404 card_not_found', async () => {
    expect((await http().get('/api/public/cards/0123456789abcdef0123456789abcdef/google-wallet').expect(404)).body.code).toBe('card_not_found');
  });

  it('pushes the latest points and merchant design to existing passes after change notices', async () => {
    const card = await prisma.cards.findUniqueOrThrow({ where: { public_id: publicId } });
    await prisma.cards.update({ where: { id: card.id }, data: { balance: 29 } });
    await prisma.vendors.update({ where: { id: vendorId }, data: { card_design: 7, logo_path: null, logo_url: 'https://example.com/new.webp', banner_url: 'https://example.com/banner.webp' } });
    requests = [];
    app.get(LiveService).cardsChanged(card.user_id);
    app.get(LiveService).vendorChanged(vendorId);
    await app.get(GoogleWalletService).reconcile();
    // Notices schedule without blocking the till's response.
    for (let i = 0; i < 100 && !requests.some(r => r.body.loyaltyPoints); i++) await new Promise(r => setTimeout(r, 10));
    expect(requests).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: expect.stringContaining(`/loyaltyObject/${ISSUER}.card-${publicId}`), body: expect.objectContaining({ loyaltyPoints: { label: 'Points', balance: { int: 29 } } }) }),
      expect.objectContaining({ body: expect.objectContaining({ hexBackgroundColor: '#0E8C99', programLogo: { sourceUri: { uri: 'https://example.com/new.webp' }, contentDescription: expect.anything() }, heroImage: { sourceUri: { uri: 'https://example.com/banner.webp' }, contentDescription: expect.anything() } }) }),
    ]));
  });

  it('keeps failed or not-yet-saved passes pending, retries, and checkpoints successful updates', async () => {
    const wallet = app.get(GoogleWalletService);
    // Finish any queued notices before changing the mocked response.
    await wallet.reconcile();
    for (const status of [503, 404]) {
      await prisma.cards.update({ where: { public_id: publicId }, data: { balance: status, pass_updated_at: null } });
      failure = status;
      await wallet.reconcile();
      expect((await prisma.cards.findUniqueOrThrow({ where: { public_id: publicId } })).pass_updated_at).toBeNull();
      failure = 0;
      await wallet.reconcile();
      const card = await prisma.cards.findUniqueOrThrow({ where: { public_id: publicId } });
      expect(card.pass_updated_at).not.toBeNull();
      expect(card.balance).toBe(status);
      requests = [];
      await wallet.reconcile();
      expect(requests).toHaveLength(0);
    }
    await prisma.vendors.update({ where: { id: vendorId }, data: { banner_url: null } });
    await wallet.reconcile();
    expect(requests.some(r => r.body.heroImage === null)).toBe(true);
  });
});
