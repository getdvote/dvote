import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { CircleCheck, CircleX, Cpu, Database, HardDrive, Image as ImageIcon, MemoryStick, RefreshCw, Smartphone, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ErrorAlert } from '../components/ErrorAlert';
import { num, PageHeader } from '../components/PageHeader';
import { api, type SystemDatabase, type SystemStatus } from '../lib/api';
import { FraudTab } from './system/FraudTab';

/** 1.2 GB / 365 KB … */
function bytes(n: number | null | undefined) {
  if (n == null || n < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

/** Loaded once; only the Refresh button reloads (numbers stay still while being read). */
const manual = { staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false } as const;

/** Platform admins: which parts of dvote are up, database size and server resources, and fraud & risk flags. */
export function System() {
  const qc = useQueryClient();
  const db = useQuery({ queryKey: ['system', 'database'], queryFn: api.systemDatabase, ...manual });
  const status = useQuery({ queryKey: ['system', 'status'], queryFn: api.systemStatus, ...manual });
  const busy = db.isFetching || status.isFetching;
  const updated = Math.max(db.dataUpdatedAt, status.dataUpdatedAt);

  return (
    <>
      <PageHeader
        title="System"
        subtitle="Which parts of dvote are up, database size and server resources, and fraud & risk flags."
        extra={
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {busy ? 'Checking…' : updated ? `Last checked ${dayjs(updated).format('D MMM, HH:mm:ss')}` : null}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                void db.refetch();
                void status.refetch();
                void qc.invalidateQueries({ queryKey: ['fraud'] });
              }}
            >
              <RefreshCw className={busy ? 'animate-spin' : undefined} /> Refresh
            </Button>
          </div>
        }
      />
      <Tabs defaultValue="status">
        <TabsList className="mb-4">
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="fraud">Fraud &amp; risk</TabsTrigger>
        </TabsList>
        <TabsContent value="status">
          <ErrorAlert error={status.error} className="mb-4" />
          {status.data ? <StatusView data={status.data} /> : status.error ? null : <Skeleton className="h-80 rounded-xl" />}
        </TabsContent>
        <TabsContent value="database">
          <ErrorAlert error={db.error} className="mb-4" />
          {db.data ? <DatabaseView data={db.data} /> : db.error ? null : <Skeleton className="h-96 rounded-xl" />}
        </TabsContent>
        <TabsContent value="fraud">
          <FraudTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

function StatusView({ data }: { data: SystemStatus }) {
  const down = data.checks.filter((c) => !c.up);
  const backend = data.checks.filter((c) => c.kind === 'api' || c.kind === 'auth');
  const appsOk = backend.length > 0 && backend.every((c) => c.up);

  return (
    <div className="grid gap-5">
      <Card className={cn('border-none', down.length ? 'bg-destructive/10' : 'bg-success/10')}>
        <CardContent className="flex items-center gap-3">
          {down.length ? <CircleX className="size-7 text-destructive" /> : <CircleCheck className="size-7 text-success" />}
          <div>
            <div className="text-lg font-semibold">{down.length ? `${down.length} part${down.length > 1 ? 's' : ''} down` : 'Everything is up'}</div>
            <div className="text-sm text-muted-foreground">
              {down.length ? down.map((c) => c.name).join(', ') : `${data.checks.length} checks passed`}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Services</CardTitle>
          <CardDescription>Each one is checked from the API server (at most 5 seconds each).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {data.checks.map((c) => (
            <StatusRow key={c.name} up={c.up} name={c.name} detail={c.detail} sub={c.url} latency={c.kind === 'api' ? null : c.latencyMs} />
          ))}
          {/* The phone apps aren't servers: they work when the API and sign-in answer. */}
          <StatusRow
            up={appsOk}
            name="Customer & staff phone apps"
            detail={appsOk ? 'Working: the API and sign-in answer' : 'Affected: the API or sign-in is down'}
            sub="Installed from the App Store / Google Play; they depend on the API and Supabase Auth"
            latency={null}
            icon={<Smartphone className="size-4" />}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function StatusRow({
  up,
  name,
  detail,
  sub,
  latency,
  icon,
}: {
  up: boolean;
  name: string;
  detail: string;
  sub?: string;
  latency: number | null;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
      {up ? <CircleCheck className="size-5 shrink-0 text-success" /> : <CircleX className="size-5 shrink-0 text-destructive" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 font-medium">
          {icon}
          {name}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {detail}
          {sub ? ` · ${sub}` : ''}
        </div>
      </div>
      {latency !== null ? <span className="text-sm text-muted-foreground tabular-nums">{latency} ms</span> : null}
      <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', up ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive')}>
        {up ? 'Up' : 'Down'}
      </span>
    </div>
  );
}

function DatabaseView({ data }: { data: SystemDatabase }) {
  const s = data.server;
  const memUsed = s?.memoryTotalBytes != null && s.memoryAvailableBytes != null ? s.memoryTotalBytes - s.memoryAvailableBytes : null;
  const diskUsed = s?.diskTotalBytes != null && s.diskAvailableBytes != null ? s.diskTotalBytes - s.diskAvailableBytes : null;
  const storageTotal = data.storage.reduce((a, b) => a + b.sizeBytes, 0);
  const files = data.storage.reduce((a, b) => a + b.files, 0);

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={<Database className="size-5" />} title="Database size" value={bytes(data.sizeBytes)} note={data.version} />
        <Tile icon={<ImageIcon className="size-5" />} title="Image storage" value={bytes(storageTotal)} note={`${num(files)} files`} />
        <Tile icon={<Users className="size-5" />} title="Sign-in accounts" value={data.authUsers >= 0 ? num(data.authUsers) : '—'} note="Customers, staff and admins" />
        <Tile
          icon={<Cpu className="size-5" />}
          title="Server load"
          value={s?.load1 != null ? s.load1.toFixed(2) : '—'}
          note={s?.cpus ? `${s.cpus} CPU · 5 min ${s.load5?.toFixed(2)} · 15 min ${s.load15?.toFixed(2)}` : 'Not reported'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Database server</CardTitle>
          <CardDescription>
            {s ? 'From Supabase’s metrics for this project.' : 'Server metrics are only available on Supabase with the secret key set.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <Meter icon={<MemoryStick className="size-4" />} label="RAM in use" used={memUsed} total={s?.memoryTotalBytes ?? null} format={bytes} />
          <Meter icon={<HardDrive className="size-4" />} label="Data disk in use" used={diskUsed} total={s?.diskTotalBytes ?? null} format={bytes} />
          <Meter icon={<Database className="size-4" />} label="Connections" used={data.connections} total={data.maxConnections} format={(n) => num(n ?? 0)} />
          <p className="text-sm text-muted-foreground">
            Reads served from memory: <span className="font-semibold text-foreground">{data.cacheHitPercent != null ? `${data.cacheHitPercent}%` : '—'}</span>{' '}
            (above 99% is healthy).
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Tables</CardTitle>
            <CardDescription>Rows and size (with indexes), biggest first.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Table</TableHead>
                    <TableHead className="text-right">Rows</TableHead>
                    <TableHead className="pr-4 text-right">Size</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.tables.map((t) => (
                    <TableRow key={t.name}>
                      <TableCell className="pl-4 font-mono text-sm">{t.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(t.rows)}</TableCell>
                      <TableCell className="pr-4 text-right tabular-nums">{bytes(t.sizeBytes)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Storage buckets</CardTitle>
            <CardDescription>Uploaded images.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {data.storage.length === 0 ? <p className="text-sm text-muted-foreground">No files yet.</p> : null}
            {data.storage.map((b) => (
              <div key={b.bucket} className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div>
                  <div className="font-medium">{b.bucket}</div>
                  <div className="text-xs text-muted-foreground">{num(b.files)} files</div>
                </div>
                <span className="font-semibold tabular-nums">{bytes(b.sizeBytes)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Tile({ icon, title, value, note }: { icon: ReactNode; title: string; value: string; note: string }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3.5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-accent-foreground">{icon}</div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-muted-foreground">{title}</div>
          <div className="mt-0.5 text-2xl font-bold tracking-tight tabular-nums">{value}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{note}</div>
        </div>
      </CardContent>
    </Card>
  );
}

/** used / total as a bar: green below 70%, amber to 90%, red above (with the % written out). */
function Meter({
  icon,
  label,
  used,
  total,
  format,
}: {
  icon: ReactNode;
  label: string;
  used: number | null;
  total: number | null;
  format: (n: number | null) => string;
}) {
  const pct = used != null && total ? Math.min(100, Math.round((used / total) * 100)) : null;
  const tone = pct == null ? 'bg-muted' : pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-warning' : 'bg-success';
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium">
          {icon}
          {label}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {pct == null ? 'Not reported' : `${format(used)} of ${format(total)} · ${pct}%`}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${label}: ${pct ?? 'unknown'}%`}>
        {pct != null ? <div className={cn('h-full rounded-full', tone)} style={{ width: `${Math.max(pct, 2)}%` }} /> : null}
      </div>
    </div>
  );
}
