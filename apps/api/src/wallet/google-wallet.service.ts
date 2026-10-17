import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { importPKCS8, SignJWT } from 'jose';
import type { Env } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { cardQr, cardSecret, hashCardSecret } from './card-token';

/** First colour of each card design (1-10), same order as CARD_DESIGNS in the dashboard and web. */
const DESIGN_COLORS = ['#1C1C1E', '#2E9E6B', '#2F6BDE', '#F2B33D', '#6155F5', '#E0533D', '#0E8C99', '#3E2723', '#AD1457', '#E9DCC9'];
const designColor = (vendorId: string, chosen: number | null) => {
  if (chosen && chosen >= 1 && chosen <= DESIGN_COLORS.length) return DESIGN_COLORS[chosen - 1];
  let h = 0;
  for (const ch of vendorId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return DESIGN_COLORS[h % DESIGN_COLORS.length];
};

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

/**
 * "Add to Google Wallet": a signed JWT save link (https://pay.google.com/gp/v/save/<jwt>) that
 * carries one LoyaltyClass per merchant (name, logo, colour) and one LoyaltyObject per card
 * (points, cardholder, short code, the card QR). Google creates both when the customer saves;
 * no Google API call is needed for that. Balance updates (REST PATCH) come later.
 */
@Injectable()
export class GoogleWalletService {
  private account?: ServiceAccount;
  private token?: { value: string; until: number };

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async saveUrl(publicId: string): Promise<string> {
    const issuerId = this.config.get('GOOGLE_WALLET_ISSUER_ID', { infer: true });
    const tokenSecret = this.config.get('WALLET_TOKEN_SECRET', { infer: true });
    if (!issuerId || !tokenSecret || !this.config.get('GOOGLE_WALLET_KEY_FILE', { infer: true })) {
      throw new ServiceUnavailableException({ code: 'wallet_not_configured', message: 'Google Wallet is not set up yet.' });
    }
    const card = await this.prisma.cards.findUnique({
      where: { public_id: publicId },
      include: { users: { select: { name: true } }, vendors: { select: { id: true, name: true, logo_url: true, card_design: true, status: true } } },
    });
    if (!card || card.vendors.status !== 'active') throw new NotFoundException({ code: 'card_not_found' });
    const v = card.vendors;

    const secret = cardSecret(tokenSecret, card.id);
    const classId = `${issuerId}.vendor-${v.id}`;
    const objectId = `${issuerId}.card-${card.public_id}`;
    const logo = v.logo_url ?? this.config.get('WALLET_DEFAULT_LOGO_URL', { infer: true });

    const loyaltyClass = {
      id: classId,
      issuerName: v.name,
      programName: `${v.name} loyalty`,
      ...(logo ? { programLogo: { sourceUri: { uri: logo }, contentDescription: { defaultValue: { language: 'en-US', value: v.name } } } } : {}),
      hexBackgroundColor: designColor(v.id, v.card_design),
      reviewStatus: 'UNDER_REVIEW',
    };
    const loyaltyObject = {
      id: objectId,
      classId,
      state: 'ACTIVE',
      accountId: card.short_code ?? '',
      accountName: card.users.name ?? '',
      loyaltyPoints: { label: 'Points', balance: { int: card.balance } },
      barcode: { type: 'QR_CODE', value: cardQr(secret), alternateText: card.short_code ?? '' },
    };

    const account = this.serviceAccount();
    const key = await importPKCS8(account.private_key, 'RS256');
    const jwt = await new SignJWT({ typ: 'savetowallet', origins: [], payload: { loyaltyClasses: [loyaltyClass], loyaltyObjects: [loyaltyObject] } })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(account.client_email)
      .setAudience('google')
      .setIssuedAt()
      .sign(key);

    const hash = hashCardSecret(secret);
    if (card.token_hash !== hash || card.google_object_id !== objectId) {
      await this.prisma.cards.update({ where: { id: card.id }, data: { token_hash: hash, google_object_id: objectId } });
    }
    return `https://pay.google.com/gp/v/save/${jwt}`;
  }

  /**
   * Whether the customer saved this card in Google Wallet: Google creates the object only when
   * the customer taps Save, so it exists = saved. Not set up, never linked, or Google unreachable
   * = false (the page then just shows the button).
   */
  async isSaved(objectId: string | null): Promise<boolean> {
    if (!objectId || !this.config.get('GOOGLE_WALLET_ISSUER_ID', { infer: true }) || !this.config.get('GOOGLE_WALLET_KEY_FILE', { infer: true })) return false;
    try {
      const res = await fetch(`https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(objectId)}`, {
        headers: { Authorization: `Bearer ${await this.accessToken()}` },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return false;
      const obj = (await res.json()) as { state?: string };
      return obj.state !== 'INACTIVE';
    } catch {
      return false;
    }
  }

  /** OAuth token for the Wallet REST API (service account, JWT bearer grant), cached ~50 min. */
  private async accessToken(): Promise<string> {
    if (this.token && this.token.until > Date.now()) return this.token.value;
    const account = this.serviceAccount();
    const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/wallet_object.issuer' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(account.client_email)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(await importPKCS8(account.private_key, 'RS256'));
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`Google token ${res.status}`);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: json.access_token, until: Date.now() + (json.expires_in - 600) * 1000 };
    return json.access_token;
  }

  private serviceAccount(): ServiceAccount {
    if (this.account) return this.account;
    const file = resolve(this.config.get('GOOGLE_WALLET_KEY_FILE', { infer: true }) as string);
    try {
      const json = JSON.parse(readFileSync(file, 'utf8')) as Partial<ServiceAccount>;
      if (!json.client_email || !json.private_key) throw new Error('missing client_email / private_key');
      this.account = { client_email: json.client_email, private_key: json.private_key };
      return this.account;
    } catch (err) {
      throw new ServiceUnavailableException({ code: 'wallet_not_configured', message: `Google Wallet key file unreadable: ${(err as Error).message}` });
    }
  }
}
