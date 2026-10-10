import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ErrorAlert } from '../../components/ErrorAlert';
import { SelectFilter } from '../../components/ListControls';
import { num, PageHeader } from '../../components/PageHeader';
import { PeriodPicker, rangeText, usePeriod } from '../../components/PeriodFilter';
import { useMe, useMyScope, useMyVendor } from '../../layouts/VendorLayout';
import { vendorApi, type InsightsKpis } from '../../lib/api';
import { cn } from '@/lib/utils';

type Metric = 'sales' | 'visits';

const chartConfig = {
  current: { label: 'This period', color: 'var(--chart-1)' },
  previous: { label: 'Previous period', color: 'var(--muted-foreground)' },
} satisfies ChartConfig;

/** How each number is defined: shown on hover of its dotted label. */
const KPIS: { key: keyof InsightsKpis; label: string; help: string; format: 'money' | 'count' | 'percent' | 'ratio' }[] = [
  { key: 'sales', label: 'Sales with dvote', help: 'The sum of the bills staff scanned to give points.', format: 'money' },
  { key: 'visits', label: 'Visits', help: 'Collects: each bill scanned for points counts as one visit.', format: 'count' },
  { key: 'avgBill', label: 'Average bill', help: 'Sales with dvote divided by visits.', format: 'money' },
  { key: 'customers', label: 'Customers', help: 'Different customers who collected points in the period.', format: 'count' },
  { key: 'newCustomers', label: 'New customers', help: 'Customers whose first ever visit here was in the period.', format: 'count' },
  { key: 'repeatRate', label: 'Repeat rate', help: 'Share of customers who came back at least twice in the period.', format: 'percent' },
  { key: 'visitsPerCustomer', label: 'Visits per customer', help: 'Visits divided by customers.', format: 'ratio' },
  { key: 'rewardsRedeemed', label: 'Rewards given', help: 'Rewards customers redeemed with their points in the period.', format: 'count' },
];

/**
 * Loyalty performance: sales through dvote, visits, average bill, customers (new / returning),
 * rewards, for a period and the one just before it. Counts only, never who the customers are.
 */
export function MyInsights() {
  const me = useMe();
  const scope = useMyScope();
  const vendor = useMyVendor();
  const branchOnly = me.role !== 'vendor_admin';
  const period = usePeriod('30d');
  const [compare, setCompare] = useState<'previous' | 'none'>('previous');
  const [branchId, setBranchId] = useState('all');
  const [metric, setMetric] = useState<Metric>('sales');

  const { from, to } = period.dates;
  const query = { from: from!, to: to!, compare, branchId: branchOnly || branchId === 'all' ? undefined : branchId };
  const { data, isLoading, error } = useQuery({
    queryKey: ['insights', 'me', query],
    queryFn: () => vendorApi.insights(query),
    enabled: !!from && !!to,
    placeholderData: (prev) => prev,
  });
  const { data: branches } = useQuery({ queryKey: ['branches', scope.key], queryFn: () => scope.branches(), enabled: !branchOnly });

  const money = (s: string) => `${Number(s).toLocaleString('en-US', { maximumFractionDigits: 0 })} ${vendor.currency}`;
  const show = (v: number | string, f: (typeof KPIS)[number]['format']) =>
    f === 'money' ? money(String(v)) : f === 'percent' ? `${Math.round(Number(v) * 100)}%` : f === 'ratio' ? Number(v).toFixed(1) : num(Number(v));
  const chart = data?.days.map((d) => ({
    date: d.date,
    current: metric === 'sales' ? Number(d.sales) : d.visits,
    previous: metric === 'sales' ? (d.previousSales === null ? null : Number(d.previousSales)) : d.previousVisits,
  }));
  const comparing = !!data?.previousRange;

  return (
    <>
      <PageHeader
        title="Insights"
        subtitle={`How your loyalty program is doing at ${branchOnly ? (me.branch?.name ?? 'your branch') : vendor.name}. Counts only: dvote never shows who your customers are.`}
      />
      <PeriodPicker state={period}>
        <SelectFilter
          label="Compare with"
          allLabel="vs previous period"
          value={compare === 'previous' ? 'all' : compare}
          onChange={(v) => setCompare(v === 'all' ? 'previous' : 'none')}
          options={[{ value: 'none', label: 'No comparison' }]}
        />
        {branchOnly ? null : (
          <SelectFilter
            label="Branch"
            allLabel="All branches"
            value={branchId}
            onChange={setBranchId}
            options={branches?.map((b) => ({ value: b.id, label: b.name }))}
          />
        )}
      </PeriodPicker>
      {data?.previousRange ? (
        <p className="-mt-2 mb-4 text-sm text-muted-foreground">
          {rangeText(data.range)} compared with {rangeText(data.previousRange)}
        </p>
      ) : null}
      {!from || !to ? <p className="mb-4 text-sm text-muted-foreground">Pick both dates to see your numbers.</p> : null}
      <ErrorAlert error={error} className="mb-4" />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((k) => (
          <Card key={k.key} className="gap-0 py-4">
            <CardContent className="px-5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="cursor-help text-sm text-muted-foreground underline decoration-dotted underline-offset-4 outline-none focus-visible:text-foreground">
                    {k.label}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-60">{k.help}</TooltipContent>
              </Tooltip>
              {isLoading || !data ? (
                <Skeleton className="mt-2 h-8 w-24" />
              ) : (
                <>
                  <div className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{show(data.current[k.key], k.format)}</div>
                  {data.previous ? <Delta current={Number(data.current[k.key])} previous={Number(data.previous[k.key])} /> : null}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-5">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{metric === 'sales' ? 'Sales with dvote' : 'Visits'} per day</CardTitle>
            <CardDescription>
              {data ? rangeText(data.range) : ''}
              {comparing ? `, dashed: ${rangeText(data!.previousRange!)}` : ''}
            </CardDescription>
          </div>
          <ToggleGroup type="single" variant="outline" value={metric} onValueChange={(v) => v && setMetric(v as Metric)} aria-label="Chart metric">
            <ToggleGroupItem value="sales" className="h-8 px-3 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
              Sales
            </ToggleGroupItem>
            <ToggleGroupItem value="visits" className="h-8 px-3 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
              Visits
            </ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent>
          {!chart ? (
            <Skeleton className="h-[280px] w-full" />
          ) : (
            <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
              <AreaChart data={chart} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="insights-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-current)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--color-current)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d: string) => dayjs(d).format('D MMM')} tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => num(v)} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(d) => dayjs(String(d)).format('dddd D MMM')} />} />
                <Area type="monotone" dataKey="current" stroke="var(--color-current)" strokeWidth={2.5} fill="url(#insights-fill)" />
                {comparing ? <Line type="monotone" dataKey="previous" stroke="var(--color-previous)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} /> : null}
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {data?.branches.length ? (
        <Card className="gap-0 py-0">
          <CardHeader className="py-4">
            <CardTitle>By branch</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Branch</TableHead>
                <TableHead className="text-right">Sales with dvote</TableHead>
                <TableHead className="text-right">Visits</TableHead>
                <TableHead className="text-right">Customers</TableHead>
                <TableHead className="pr-6 text-right">Average bill</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.branches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="pl-6 font-semibold">{b.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(b.sales)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(b.visits)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(b.customers)}</TableCell>
                  <TableCell className="pr-6 text-right tabular-nums">{b.visits ? money(b.avgBill) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}
      {data ? <p className="mt-3 text-xs text-muted-foreground">Updated {dayjs(data.updatedAt).format('HH:mm')}. Days are Cairo days.</p> : null}
    </>
  );
}

/** "+12% vs previous" (green up / red down), or a dash when the previous period had nothing to compare with. */
function Delta({ current, previous }: { current: number; previous: number }) {
  if (!previous) {
    return <div className="mt-1 text-xs text-muted-foreground">{current ? 'No earlier data to compare' : '— vs previous'}</div>;
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="mt-1 flex items-center gap-1 text-xs">
      <span className={cn('inline-flex items-center gap-0.5 font-semibold', pct === 0 ? 'text-muted-foreground' : up ? 'text-success' : 'text-destructive')}>
        {pct === 0 ? null : <Icon className="size-3.5" />}
        {pct > 0 ? '+' : ''}
        {pct}%
      </span>
      <span className="text-muted-foreground">vs previous</span>
    </div>
  );
}
