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
import { NeedsAttention } from './NeedsAttention';

const chartConfig = {
  pointsEarned: { label: 'Points', color: 'var(--chart-1)' },
  collects: { label: 'Collects', color: 'var(--chart-1)' },
} satisfies ChartConfig;

/** Vendor home: my shop's activity (counts only, never who the customers are). */
export function MyHome() {
  const me = useMe();
  const vendor = useMyVendor();
  const { data, isLoading, error } = useQuery({ queryKey: ['summary', 'me'], queryFn: vendorApi.summary, refetchInterval: 60_000 });
  const branchOnly = me.role !== 'vendor_admin';

  return (
    <>
      <PageHeader
        title={`Hi ${me.name.split(' ')[0]}`}
        subtitle={`${branchOnly ? me.branch?.name : vendor.name} today, ${dayjs().format('dddd D MMMM')}`}
      />
      <div className="mb-5">
        <NeedsAttention />
      </div>
      <ErrorAlert error={error} className="mb-4" />
      {isLoading || !data ? (
        error ? null : <OverviewSkeleton />
      ) : (
        <div className="grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={Zap} title="Collects today" value={data.collectsToday} note={`${num(data.pointsToday)} points given today`} />
            <Stat icon={Users} title="Customers" value={data.customers} note={`+${num(data.newCustomers7d)} new this week`} />
            <Stat icon={Trophy} title="Points earned · 30 days" value={data.pointsEarned30d} note={branchOnly ? 'At your branch' : 'All branches'} />
            <Stat icon={Gift} title="Points held by customers" value={data.pointsOutstanding} note={`${num(data.pointsRedeemed30d)} redeemed in 30 days`} />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Points earned · last 14 days</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
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
                <CardTitle>Collects per day</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
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
              <CardTitle>{branchOnly ? 'My branch · 30 days' : 'Branches · 30 days'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Branch</TableHead>
                      <TableHead className="text-right">Collects</TableHead>
                      <TableHead className="pr-4 text-right">Points given</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableState loading={false} empty={!data.branches.length} colSpan={3} emptyText="No open branches" />
                    {data.branches.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="pl-4 font-semibold">{b.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(b.collects)}</TableCell>
                        <TableCell className="pr-4 text-right font-semibold tabular-nums">{num(b.pointsEarned)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            Customers and points held count everyone with a card at {vendor.name}. dvote never shows you who your customers are.
          </p>
        </div>
      )}
    </>
  );
}
