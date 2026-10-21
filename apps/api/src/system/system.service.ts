import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.validation';
import { LiveService } from '../live/live.service';
import { PrismaService } from '../prisma/prisma.service';
import type { DatabaseStatsDto, StatusCheckDto, SystemStatusDto } from './system.dto';

const TIMEOUT_MS = 5000;
const METRICS_CACHE_MS = 30_000;

/** Prometheus text: the first value of a metric whose labels contain every `match` pair. */
function metric(text: string, name: string, match: Record<string, string> = {}): number | null {
  for (const line of text.split('\n')) {
    if (!line.startsWith(name + '{') && !line.startsWith(name + ' ')) continue;
    if (!Object.entries(match).every(([k, v]) => line.includes(`${k}="${v}"`))) continue;
    const n = Number(line.slice(line.lastIndexOf(' ') + 1));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** GET with a timeout: up (any answer below 500), or down with why. */
async function probe(url: string, headers: Record<string, string> = {}): Promise<{ ok: boolean; ms: number; detail: string }> {
  const start = Date.now();
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'follow' });
    return { ok: res.status < 500, ms: Date.now() - start, detail: `HTTP ${res.status}` };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    return { ok: false, ms: Date.now() - start, detail: timedOut ? `No answer in ${TIMEOUT_MS / 1000} s` : 'Not reachable' };
  }
}

/**
 * Platform health for the admin dashboard: database / storage sizes and the database server's
 * memory, disk and load (Supabase's metrics endpoint), and which parts of dvote are up.
 */
@Injectable()
export class SystemService {
  private metricsCache: { at: number; text: string | null } = { at: 0, text: null };

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly live: LiveService,
  ) {}

  private get supabaseUrl() {
    return this.config.get('SUPABASE_URL', { infer: true }).replace(/\/+$/, '');
  }

  private get secretKey() {
    return this.config.get('SUPABASE_SECRET_KEY', { infer: true }) ?? '';
  }

  /** Supabase's Prometheus metrics for this project (the database server's own numbers). */
  private async metrics(): Promise<string | null> {
    if (Date.now() - this.metricsCache.at < METRICS_CACHE_MS) return this.metricsCache.text;
    let text: string | null = null;
    if (this.secretKey && this.supabaseUrl.includes('.supabase.co')) {
      try {
        const res = await fetch(`${this.supabaseUrl}/customer/v1/privileged/metrics`, {
          headers: { Authorization: 'Basic ' + Buffer.from(`service_role:${this.secretKey}`).toString('base64') },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.ok) text = await res.text();
      } catch {
        text = null;
      }
    }
    this.metricsCache = { at: Date.now(), text };
    return text;
  }

  async database(): Promise<DatabaseStatsDto> {
    const [[db], tables, buckets, [auth], text] = await Promise.all([
      this.prisma.$queryRaw<{ size: bigint; version: string; conns: bigint; max_conns: string; hit: number | null }[]>`
        SELECT pg_database_size(current_database()) AS size,
               split_part(version(), ' on ', 1) AS version,
               (SELECT count(*) FROM pg_stat_activity) AS conns,
               current_setting('max_connections') AS max_conns,
               (SELECT round(100.0 * sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0), 2)::float8
                  FROM pg_stat_database WHERE datname = current_database()) AS hit`,
      this.prisma.$queryRaw<{ name: string; rows: bigint; size: bigint }[]>`
        SELECT relname AS name, n_live_tup AS rows, pg_total_relation_size(relid) AS size
        FROM pg_stat_user_tables WHERE schemaname = 'public' AND relname <> '_prisma_migrations'
        ORDER BY pg_total_relation_size(relid) DESC`,
      this.prisma.$queryRaw<{ bucket: string; files: bigint; size: bigint | null }[]>`
        SELECT bucket_id AS bucket, count(*) AS files, sum((metadata->>'size')::bigint) AS size
        FROM storage.objects GROUP BY bucket_id ORDER BY bucket_id`.catch(() => []),
      this.prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM auth.users`.catch(() => [{ n: -1n }]),
      this.metrics(),
    ]);

    const db_ = { service_type: 'db' };
    const dataDisk = { ...db_, mountpoint: '/data' };
    const cpus = text ? new Set([...text.matchAll(/node_cpu_seconds_total\{[^}]*cpu="(\d+)"/g)].map((m) => m[1])).size : 0;
    const server = text
      ? {
          memoryTotalBytes: metric(text, 'node_memory_MemTotal_bytes', db_),
          memoryAvailableBytes: metric(text, 'node_memory_MemAvailable_bytes', db_),
          diskTotalBytes: metric(text, 'node_filesystem_size_bytes', dataDisk),
          diskAvailableBytes: metric(text, 'node_filesystem_avail_bytes', dataDisk),
          load1: metric(text, 'node_load1', db_),
          load5: metric(text, 'node_load5', db_),
          load15: metric(text, 'node_load15', db_),
          cpus: cpus || null,
        }
      : null;

    return {
      sizeBytes: Number(db.size),
      version: db.version,
      connections: Number(db.conns),
      maxConnections: Number(db.max_conns),
      cacheHitPercent: db.hit,
      authUsers: Number(auth.n),
      tables: tables.map((t) => ({ name: t.name, rows: Number(t.rows), sizeBytes: Number(t.size) })),
      storage: buckets.map((b) => ({ bucket: b.bucket, files: Number(b.files), sizeBytes: Number(b.size ?? 0) })),
      server,
      checkedAt: new Date().toISOString(),
    };
  }

  /** Which parts of dvote answer right now (each check at most 5 s, all at once). */
  async status(): Promise<SystemStatusDto> {
    const mem = process.memoryUsage();
    const api: StatusCheckDto = {
      name: 'API (NestJS)',
      kind: 'api',
      up: true,
      latencyMs: 0,
      detail: `Up ${Math.floor(process.uptime() / 3600)} h ${Math.floor((process.uptime() % 3600) / 60)} min · ${Math.round(mem.rss / 1048576)} MB RAM · Node ${process.version} · ${this.live.connected} app(s) live`,
    };

    const dbCheck = (async (): Promise<StatusCheckDto> => {
      const start = Date.now();
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        return { name: 'Database (PostgreSQL)', kind: 'database', up: true, latencyMs: Date.now() - start, detail: 'Answers queries' };
      } catch {
        return { name: 'Database (PostgreSQL)', kind: 'database', up: false, latencyMs: Date.now() - start, detail: 'Query failed' };
      }
    })();

    const keyHeaders: Record<string, string> = this.secretKey ? { apikey: this.secretKey, Authorization: `Bearer ${this.secretKey}` } : {};
    const service = async (name: string, kind: StatusCheckDto['kind'], url: string): Promise<StatusCheckDto> => {
      const r = await probe(url, keyHeaders);
      return { name, kind, up: r.ok, latencyMs: r.ms, detail: r.detail, url };
    };

    const targets = (this.config.get('STATUS_TARGETS', { infer: true }) ?? '')
      .split(',')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const at = pair.indexOf('=');
        return at > 0 ? { name: pair.slice(0, at).trim(), url: pair.slice(at + 1).trim() } : null;
      })
      .filter((t): t is { name: string; url: string } => !!t && /^https?:\/\//.test(t.url));

    const checks = await Promise.all([
      Promise.resolve(api),
      dbCheck,
      service('Sign-in (Supabase Auth)', 'auth', `${this.supabaseUrl}/auth/v1/health`),
      service('Image storage (Supabase Storage)', 'storage', `${this.supabaseUrl}/storage/v1/bucket`),
      ...targets.map(async (t) => {
        const r = await probe(t.url);
        return { name: t.name, kind: 'website' as const, up: r.ok, latencyMs: r.ms, detail: r.detail, url: t.url };
      }),
    ]);
    return { checks, checkedAt: new Date().toISOString() };
  }
}
