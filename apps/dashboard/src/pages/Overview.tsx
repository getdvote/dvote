import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Store, Trophy, Users, Zap, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Empty, EmptyDescription, EmptyHeader } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorAlert } from '../components/ErrorAlert';
import { num, PageHeader } from '../components/PageHeader';
import { api } from '../lib/api';

const chartConfig = {
  pointsEarned: { label: 'Points', color: 'var(--chart-1)' },
  collects: { label: 'Collects', color: 'var(--chart-1)' },
  newCustomers: { label: 'Sign-ups', color: 'var(--chart-2)' },
} satisfies ChartConfig;

/** Home: the whole system at a glance. */
export function Overview() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ['overview'], queryFn: api.overview, refetchInterval: 60_000 });

  return (
    <>
      <PageHeader title="Overview" subtitle={`dvote today, ${dayjs().format('dddd D MMMM')}`} />
      <ErrorAlert error={error} className="mb-4" />
      {isLoading || !data ? (
        error ? null : <OverviewSkeleton />
      ) : (
        <div className="grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              icon={Store}
              title="Active merchants"
              value={data.vendorsActive}
              note={`${num(data.branchesOpen)} open branches · ${num(data.vendorsSuspended)} suspended`}
            />
            <Stat
              icon={Users}
              title="Customers"
              value={data.customers}
              note={`+${num(data.customersNew7d)} this week · ${num(data.customersBlocked)} blocked`}
            />
            <Stat icon={Zap} title="Collects today" value={data.collectsToday} note={`${num(data.cards)} loyalty cards in total`} />
            <Stat
              icon={Trophy}
              title="Points held by customers"
              value={data.pointsOutstanding}
              note={`${num(data.pointsEarned)} earned · ${num(data.pointsRedeemed)} redeemed`}
            />
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
                      <linearGradient id="pts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-pointsEarned)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--color-pointsEarned)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(d: string) => dayjs(d).format('D MMM')} tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent labelFormatter={(d) => dayjs(String(d)).format('dddd D MMM')} />} />
                    <Area type="monotone" dataKey="pointsEarned" stroke="var(--color-pointsEarned)" strokeWidth={2.5} fill="url(#pts)" />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Busiest shops · 30 days</CardTitle>
              </CardHeader>
              <CardContent>
                {data.topVendors.length === 0 ? (
                  <Empty className="py-8">
                    <EmptyHeader>
                      <EmptyDescription>No collects yet</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ul className="-mx-2 grid gap-1">
                    {data.topVendors.map((v, i) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => navigate(`/merchants/${v.id}`)}
                          className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted"
                        >
                          <Avatar className="size-10">
                            <AvatarImage src={v.logoUrl ?? undefined} alt="" />
                            <AvatarFallback className="bg-brand-soft font-semibold text-accent-foreground">{i + 1}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{v.name}</div>
                            <div className="text-xs text-muted-foreground">{num(v.collects)} collects</div>
                          </div>
                          <span className="font-semibold tabular-nums">{num(v.pointsEarned)} pts</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <DailyBars title="Collects per day" data={data.days} dataKey="collects" />
            <DailyBars title="New customers per day" data={data.days} dataKey="newCustomers" />
          </div>
        </div>
      )}
    </>
  );
}

function DailyBars({ title, data, dataKey }: { title: string; data: { date: string }[]; dataKey: 'collects' | 'newCustomers' }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[200px] w-full">
          <BarChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d: string) => dayjs(d).format('D')} tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(d) => dayjs(String(d)).format('D MMM')} />} />
            <Bar dataKey={dataKey} fill={`var(--color-${dataKey})`} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function Stat({ icon: Icon, title, value, note }: { icon: LucideIcon; title: string; value: number; note: string }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3.5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-accent-foreground">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-muted-foreground">{title}</div>
          <div className="mt-0.5 text-2xl font-bold tracking-tight tabular-nums">{num(value)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{note}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function OverviewSkeleton() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Skeleton className="h-[360px] rounded-xl xl:col-span-2" />
        <Skeleton className="h-[360px] rounded-xl" />
      </div>
    </div>
  );
}
