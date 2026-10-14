import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Gift, Trophy, Users, Zap } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ErrorAlert } from '../../components/ErrorAlert';
import { num, PageHeader } from '../../components/PageHeader';
import { TableState } from '../../components/TableState';
import { useMe, useMyVendor } from '../../layouts/VendorLayout';
import { vendorApi } from '../../lib/api';
import { OverviewSkeleton, Stat } from '../Overview';
import { GoLiveChecklist, useGoLivePending } from './GoLiveChecklist';
import { NeedsAttention } from './NeedsAttention';
import { t } from '../../i18n';

const chartConfig = () =>
  ({
    pointsEarned: { label: t('home.points'), color: 'var(--chart-1)' },
    collects: { label: t('home.collects'), color: 'var(--chart-1)' },
  }) satisfies ChartConfig;

/** Vendor home: my shop's activity (counts only, never who the customers are). */
export function MyHome() {
  const me = useMe();
  const vendor = useMyVendor();
  const { data, isLoading, error } = useQuery({ queryKey: ['summary', 'me'], queryFn: vendorApi.summary, refetchInterval: 60_000 });
  const branchOnly = me.role !== 'vendor_admin';
  // while the go-live steps show, setup tips live there instead of twice
  const goLivePending = useGoLivePending(!branchOnly);

  return (
    <>
      <PageHeader
        title={t('home.hi', { name: me.name.split(' ')[0] })}
        subtitle={t('home.today', { shop: (branchOnly ? me.branch?.name : vendor.name) ?? '', date: dayjs().format('dddd D MMMM') })}
      />
      {branchOnly ? null : <GoLiveChecklist className="mb-5" />}
      <div className="mb-5">
        <NeedsAttention hideSetup={goLivePending} />
      </div>
      <ErrorAlert error={error} className="mb-4" />
      {isLoading || !data ? (
        error ? null : <OverviewSkeleton />
      ) : (
        <div className="grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={Zap} title={t('home.collectsToday')} value={data.collectsToday} note={t('home.pointsGivenToday', { n: data.pointsToday })} />
            <Stat icon={Users} title={t('home.customers')} value={data.customers} note={t('home.newThisWeek', { n: data.newCustomers7d })} />
            <Stat icon={Trophy} title={t('home.earned30')} value={data.pointsEarned30d} note={branchOnly ? t('home.atYourBranch') : t('home.allBranches')} />
            <Stat icon={Gift} title={t('home.held')} value={data.pointsOutstanding} note={t('home.redeemed30', { n: data.pointsRedeemed30d })} />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>{t('home.earned14')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig()} className="aspect-auto h-[280px] w-full">
                  <AreaChart data={data.days} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="mypts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-pointsEarned)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--color-pointsEarned)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(d: string) => dayjs(d).format('D MMM')} tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent labelFormatter={(d) => dayjs(String(d)).format('dddd D MMM')} />} />
                    <Area type="monotone" dataKey="pointsEarned" stroke="var(--color-pointsEarned)" strokeWidth={2.5} fill="url(#mypts)" />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('home.collectsPerDay')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig()} className="aspect-auto h-[280px] w-full">
                  <BarChart data={data.days} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(d: string) => dayjs(d).format('D')} tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(d) => dayjs(String(d)).format('D MMM')} />} />
                    <Bar dataKey="collects" fill="var(--color-collects)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{branchOnly ? t('home.myBranch30') : t('home.branches30')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="ps-4">{t('common.branch')}</TableHead>
                      <TableHead className="text-end">{t('home.collects')}</TableHead>
                      <TableHead className="pe-4 text-end">{t('home.pointsGiven')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableState loading={false} empty={!data.branches.length} colSpan={3} emptyText={t('home.noBranches')} />
                    {data.branches.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="ps-4 font-semibold">{b.name}</TableCell>
                        <TableCell className="text-end tabular-nums">{num(b.collects)}</TableCell>
                        <TableCell className="pe-4 text-end font-semibold tabular-nums">{num(b.pointsEarned)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            {t('home.footnote', { shop: vendor.name })}
          </p>
        </div>
      )}
    </>
  );
}
