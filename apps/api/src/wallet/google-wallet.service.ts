import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Injectable, Logger, NotFoundException, ServiceUnavailableException, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { importPKCS8, SignJWT } from 'jose';
import type { Env } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { cardQr, cardSecret, hashCardSecret } from './card-token';
import { WalletLogoService } from '../storage/wallet-logo.service';

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

/** Only controlled diagnostics reach logs; never dump credentials, request bodies or tokens. */
export class WalletRequestError extends Error {
  constructor(message: string, readonly httpStatus: number) { super(message); }
}

async function googleFailure(operation: string, response: Response): Promise<WalletRequestError> {
  let reason = '';
  try {
    const body = await response.json() as { error?: { status?: unknown; errors?: { reason?: unknown }[] } };
    const code = body.error?.status ?? body.error?.errors?.[0]?.reason;
    if (typeof code === 'string' && /^[A-Za-z0-9_]{1,80}$/.test(code)) reason = ` (${code})`;
  } catch { /* Some gateways return an empty or HTML error response. */ }
  return new WalletRequestError(`${operation}: HTTP ${response.status}${reason}`, response.status);
}

/**
 * "Add to Google Wallet": a signed JWT save link (https://pay.google.com/gp/v/save/<jwt>) that
 * carries one LoyaltyClass per merchant (name, logo, colour) and one LoyaltyObject per card
 * (points, cardholder, short code, the card QR). Google creates both when the customer saves;
 * no Google API call is needed for that. Existing passes are synchronized through REST PATCH.
 */
@Injectable()
export class GoogleWalletService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger(GoogleWalletService.name);
  private readonly pending = new Set<string>();
  private running?: Promise<void>;
  private timer?: NodeJS.Timeout;
  private stopped = false;
  private account?: ServiceAccount;
  private token?: { value: string; until: number };

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly walletLogos: WalletLogoService,
  ) {}

  private get configured(): boolean {
    return !!this.config.get('GOOGLE_WALLET_ISSUER_ID', { infer: true }) && !!this.config.get('GOOGLE_WALLET_KEY_FILE', { infer: true });
  }

  get enabled(): boolean { return this.configured; }

  /** Per-card messages keep a segmented broadcast off every other customer's pass. */
  async notifyCard(objectId: string, messageId: string, title: string, body: string): Promise<{ status: 'accepted' | 'skipped' | 'failed'; reason: string | null }> {
    const issuer = this.config.get('GOOGLE_WALLET_ISSUER_ID', { infer: true });
    if (!this.configured || !objectId.startsWith(`${issuer}.`)) return { status: 'failed', reason: 'wallet_not_configured' };
    const url = `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(objectId)}`;
    const headers = { Authorization: `Bearer ${await this.accessToken()}`, 'Content-Type': 'application/json' };
    const existing = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
    if (existing.status === 404) return { status: 'skipped', reason: 'not_saved' };
    if (!existing.ok) throw await googleFailure('Google Wallet message lookup', existing);
    const pass = await existing.json() as { hasUsers?: boolean; messages?: { id?: string }[] };
    if (pass.hasUsers === false) return { status: 'skipped', reason: 'not_saved' };
    if (pass.messages?.some(m => m.id === messageId)) return { status: 'accepted', reason: null };
    // Google stores at most ten messages on a pass. Remove only our oldest broadcasts.
    const messages = pass.messages ?? [];
    if (messages.length >= 10) {
      const index = messages.findIndex(m => m.id?.startsWith('dvote-broadcast-'));
      if (index < 0) return { status: 'failed', reason: 'message_limit' };
      await this.patch('loyaltyObject', objectId, { messages: messages.filter((_, i) => i !== index) });
    }
    const response = await fetch(`${url}/addMessage`, {
      method: 'POST', headers, signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ message: { id: messageId, header: title, body, messageType: 'TEXT_AND_NOTIFY' } }),
    });
    if (response.status === 429) return { status: 'skipped', reason: 'google_quota' };
    if (!response.ok) throw await googleFailure('Google Wallet addMessage', response);
    return { status: 'accepted', reason: null };
  }

  onApplicationBootstrap(): void {
    if (!this.configured) return;
    this.timer = setInterval(() => void this.reconcile(), 60_000);
    this.timer.unref();
    void this.reconcile(true);
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    clearInterval(this.timer);
    await this.running;
  }

  /** Called only after the points transaction commits; network failures never undo points. */
  userChanged(userId: string): void {
    void this.enqueue({ user_id: userId });
  }

  vendorChanged(vendorId: string): void {
    void this.enqueue({ vendor_id: vendorId });
  }

  private async enqueue(scope: { user_id?: string; vendor_id?: string }): Promise<void> {
    if (!this.configured || this.stopped) return;
    try {
      const cards = await this.prisma.cards.findMany({ where: { ...scope, google_object_id: { not: null } }, select: { id: true } });
      for (const card of cards) this.pending.add(card.id);
      this.drain();
    } catch {
      this.log.warn('Could not schedule Google Wallet update; reconciliation will retry.');
    }
  }

  /** The existing pass_updated_at checkpoint survives restarts and outages. */
  async reconcile(force = false): Promise<void> {
    if (!this.configured || this.stopped) return;
    try {
      let cursor = '';
      while (!this.stopped) {
        const cards = await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT c.id FROM cards c JOIN vendors v ON v.id = c.vendor_id
          WHERE c.google_object_id IS NOT NULL AND c.id::text > ${cursor}
            AND (${force} OR c.pass_updated_at IS NULL OR c.updated_at > c.pass_updated_at OR v.updated_at > c.pass_updated_at)
          ORDER BY c.id::text LIMIT 100`;
        if (!cards.length) break;
        for (const card of cards) this.pending.add(card.id);
        this.drain();
        cursor = cards[cards.length - 1].id;
        await this.running;
      }
    } catch {
      this.log.warn('Google Wallet reconciliation failed; will retry in one minute.');
    }
  }

  private drain(): void {
    if (this.running || this.stopped) return;
    this.running = (async () => {
      while (this.pending.size && !this.stopped) {
        const id = this.pending.values().next().value!;
        this.pending.delete(id);
        try { await this.syncCard(id); } catch (error) {
          const reason = error instanceof WalletRequestError ? error.message
            : error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? 'request timed out'
            : error instanceof TypeError ? 'network request failed'
            : 'local configuration or database error';
          this.log.warn(`Google Wallet update failed for card ${id}: ${reason}; reconciliation will retry.`);
        }
      }
    })().finally(() => { this.running = undefined; });
  }

  /** Serial execution prevents older balance snapshots overwriting newer ones. */
  private async syncCard(id: string): Promise<void> {
    const started = new Date();
    const card = await this.prisma.cards.findUnique({ where: { id }, include: { users: { select: { name: true } }, vendors: true } });
    if (!card?.google_object_id) return;
    const issuer = this.config.get('GOOGLE_WALLET_ISSUER_ID', { infer: true });
    if (!card.google_object_id.startsWith(`${issuer}.`)) return;
    const v = card.vendors;
    if (!await this.patch('loyaltyObject', card.google_object_id, {
      loyaltyPoints: { label: 'Points', balance: { int: card.balance } },
      accountName: card.users.name ?? '',
      state: v.status === 'active' ? 'ACTIVE' : 'INACTIVE',
    })) return;
    if (!await this.patch('loyaltyClass', `${issuer}.vendor-${v.id}`, await this.branding(v))) return;
    // now() also equals the updated_at trigger's timestamp. Do not checkpoint a newer
    // balance/branding change that happened while Google was processing this snapshot.
    await this.prisma.$executeRaw`
      UPDATE cards c SET pass_updated_at = now()
      WHERE c.id = ${id}::uuid AND c.balance = ${card.balance}
        AND c.google_object_id = ${card.google_object_id}
        AND EXISTS (SELECT 1 FROM vendors v WHERE v.id = c.vendor_id AND v.updated_at <= ${started})`;
  }

  private async patch(resource: 'loyaltyClass' | 'loyaltyObject', id: string, body: unknown): Promise<boolean> {
    const res = await fetch(`https://walletobjects.googleapis.com/walletobjects/v1/${resource}/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${await this.accessToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(4000),
    });
    // A save link can exist before the customer actually saves the card. Keep it pending.
    if (res.status === 404) return false;
    if (!res.ok) {
      if (res.status === 401) this.token = undefined;
      throw await googleFailure(`Google Wallet ${resource} PATCH`, res);
    }
    return true;
  }

  private async branding(v: { id: string; name: string; logo_url: string | null; logo_path: string | null; banner_url: string | null; card_design: number | null; wallet_nearby_enabled?: boolean }) {
    const logo = v.logo_path ? await this.walletLogos.ensure(v.logo_path) : v.logo_url ?? this.config.get('WALLET_DEFAULT_LOGO_URL', { infer: true });
    const branches = v.wallet_nearby_enabled ? await this.prisma.branches.findMany({
      where: { vendor_id: v.id, status: 'active', lat: { not: null }, lng: { not: null } },
      select: { lat: true, lng: true }, orderBy: { id: 'asc' }, take: 10,
    }) : [];
    return {
      merchantLocations: branches.map(b => ({ latitude: Number(b.lat), longitude: Number(b.lng) })),
      // Required even when PATCHing an already approved class.
      reviewStatus: 'UNDER_REVIEW',
      issuerName: v.name, programName: `${v.name} loyalty`,
      ...(logo ? { programLogo: { sourceUri: { uri: logo }, contentDescription: { defaultValue: { language: 'en-US', value: v.name } } } } : {}),
      heroImage: v.banner_url ? { sourceUri: { uri: v.banner_url }, contentDescription: { defaultValue: { language: 'en-US', value: v.name } } } : null,
      hexBackgroundColor: designColor(v.id, v.card_design),
    };
  }

  async saveUrl(publicId: string): Promise<string> {
    const issuerId = this.config.get('GOOGLE_WALLET_ISSUER_ID', { infer: true });
    const tokenSecret = this.config.get('WALLET_TOKEN_SECRET', { infer: true });
    if (!issuerId || !tokenSecret || !this.config.get('GOOGLE_WALLET_KEY_FILE', { infer: true })) {
      throw new ServiceUnavailableException({ code: 'wallet_not_configured', message: 'Google Wallet is not set up yet.' });
    }
    const card = await this.prisma.cards.findUnique({
      where: { public_id: publicId },
      include: { users: { select: { name: true } }, vendors: true },
    });
    if (!card || card.vendors.status !== 'active') throw new NotFoundException({ code: 'card_not_found' });
    const v = card.vendors;

    const secret = cardSecret(tokenSecret, card.id);
    const classId = `${issuerId}.vendor-${v.id}`;
    const objectId = `${issuerId}.card-${card.public_id}`;

    const loyaltyClass = {
      id: classId,
      ...await this.branding(v),
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
      const obj = (await res.json()) as { state?: string; hasUsers?: boolean };
      return obj.hasUsers === true && obj.state !== 'INACTIVE';
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
    if (!res.ok) throw await googleFailure('Google OAuth token', res);
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
