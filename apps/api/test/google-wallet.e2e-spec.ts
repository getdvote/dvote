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

const ISSUER = '3388000000099999999';
const vendorId = randomUUID();
const email = `gw-${randomUUID().slice(0, 8)}@test.dvote`;

describe('Add to Google Wallet (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let publicId = '';
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const v = await prisma.vendors.create({ data: { id: vendorId, name: `Wallet Cafe ${vendorId.slice(0, 6)}`, card_design: 3, logo_url: 'https://example.com/logo.png' } });
    const res = await http().post(`/api/public/vendors/${v.slug}/join`).send({ name: 'Mona Ali', email, phone: '01001234567', ageConfirmed: true, source: 'nfc' }).expect(200);
    publicId = res.body.card.publicId;
  });

  afterAll(async () => {
    await prisma.cards.deleteMany({ where: { vendor_id: vendorId } });
    await prisma.vendors.deleteMany({ where: { id: vendorId } });
    await prisma.users.deleteMany({ where: { email } });
    await app.close();
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

  it('unknown card → 404 card_not_found', async () => {
    expect((await http().get('/api/public/cards/0123456789abcdef0123456789abcdef/google-wallet').expect(404)).body.code).toBe('card_not_found');
  });
});
