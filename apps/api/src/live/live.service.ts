import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import { CUSTOMER_PROVIDERS } from '../auth/customer-auth.guard';
import { SupabaseJwtVerifier } from '../auth/supabase-jwt.verifier';
import { PrismaService } from '../prisma/prisma.service';

/** Where customer apps connect: ws(s)://<api>/api/app/live */
export const LIVE_PATH = '/api/app/live';

/**
 * What the app is told. Notices carry no data, only "this changed": the app re-reads it
 * through the normal (guarded) API, so nothing private is ever pushed.
 * - vendor: a shop's public info changed (logo, banner, rule, rewards, branches, menu…);
 *   vendorId null = some shop (when the dashboard route doesn't name it).
 * - cards: this customer's points changed (a collect at the counter).
 */
export type LiveEvent = { type: 'vendor'; vendorId: string | null } | { type: 'cards' };

interface Client {
  socket: WebSocket;
  userId: string | null; // null until the auth message is accepted
  alive: boolean;
}

const AUTH_TIMEOUT_MS = 10_000;
const HEARTBEAT_MS = 30_000;

/**
 * Live updates for the customer app over a WebSocket (one API container, so an in-memory
 * list of connections is enough; with several containers this would need a shared channel).
 *
 * The app connects, then sends {"type":"auth","token":"<Supabase access token>"} (the token
 * never goes in the URL, so it isn't logged). Unauthenticated sockets are closed after 10 s.
 */
@Injectable()
export class LiveService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('Live');
  private readonly wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  private readonly clients = new Set<Client>();
  private heartbeat?: NodeJS.Timeout;
  private server?: Server;

  constructor(
    private readonly http: HttpAdapterHost,
    private readonly verifier: SupabaseJwtVerifier,
    private readonly prisma: PrismaService,
  ) {}

  onApplicationBootstrap(): void {
    this.server = this.http.httpAdapter.getHttpServer() as Server;
    this.server.on('upgrade', this.onUpgrade);
    this.wss.on('connection', (socket) => this.onConnection(socket));
    this.heartbeat = setInterval(() => this.ping(), HEARTBEAT_MS);
    this.heartbeat.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.heartbeat);
    this.server?.off('upgrade', this.onUpgrade);
    for (const c of this.clients) c.socket.terminate();
    this.clients.clear();
    this.wss.close();
  }

  /** A dashboard saved something about a shop: every connected app re-reads what it shows. */
  vendorChanged(vendorId: string | null): void {
    this.send(() => true, { type: 'vendor', vendorId });
  }

  /** This customer's points changed. */
  cardsChanged(userId: string): void {
    this.send((c) => c.userId === userId, { type: 'cards' });
  }

  /** Connected, signed-in apps (for tests and logs). */
  get connected(): number {
    return [...this.clients].filter((c) => c.userId).length;
  }

  private send(to: (c: Client) => boolean, event: LiveEvent) {
    const message = JSON.stringify(event);
    for (const c of this.clients) {
      if (c.userId && to(c) && c.socket.readyState === WebSocket.OPEN) c.socket.send(message);
    }
  }

  private readonly onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const path = (req.url ?? '').split('?')[0];
    if (path !== LIVE_PATH) return; // not ours: leave it to anything else listening
    this.wss.handleUpgrade(req, socket, head, (ws) => this.wss.emit('connection', ws, req));
  };

  private onConnection(socket: WebSocket) {
    const client: Client = { socket, userId: null, alive: true };
    this.clients.add(client);
    const authTimer = setTimeout(() => !client.userId && socket.close(4401, 'auth_timeout'), AUTH_TIMEOUT_MS);

    socket.on('pong', () => (client.alive = true));
    socket.on('close', () => {
      clearTimeout(authTimer);
      this.clients.delete(client);
    });
    socket.on('error', () => socket.terminate());
    socket.on('message', (raw) => {
      if (client.userId) return; // the only message we expect is the first one
      void this.authenticate(client, raw.toString()).then((ok) => {
        clearTimeout(authTimer);
        if (ok) socket.send(JSON.stringify({ type: 'ready' }));
      });
    });
  }

  /** Same checks as CustomerAuthGuard: a valid customer token for an active customer. */
  private async authenticate(client: Client, raw: string): Promise<boolean> {
    const reject = (code: string) => {
      client.socket.close(code === 'user_blocked' ? 4403 : 4401, code);
      return false;
    };
    let token: unknown;
    try {
      token = (JSON.parse(raw) as { type?: string; token?: unknown }).token;
    } catch {
      return reject('invalid_message');
    }
    if (typeof token !== 'string' || !token) return reject('missing_token');
    try {
      const claims = await this.verifier.verify(token);
      const providers = claims.app_metadata?.providers ?? [claims.app_metadata?.provider];
      if (claims.is_anonymous || !providers.some((p) => p !== undefined && CUSTOMER_PROVIDERS.has(p))) {
        return reject('provider_not_allowed');
      }
      const user = await this.prisma.users.findFirst({ where: { auth_user_id: claims.sub }, select: { id: true, status: true } });
      if (!user) return reject('invalid_token');
      if (user.status !== 'active') return reject('user_blocked');
      client.userId = user.id;
      return true;
    } catch {
      return reject('invalid_token');
    }
  }

  /** Drop connections that stopped answering (phone went offline without closing). */
  private ping() {
    for (const c of this.clients) {
      if (!c.alive) {
        c.socket.terminate();
        continue;
      }
      c.alive = false;
      c.socket.ping();
    }
    if (this.clients.size) this.log.debug(`${this.connected} app(s) connected`);
  }
}
