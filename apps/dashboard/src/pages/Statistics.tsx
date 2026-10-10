import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { QrCode, RefreshCw, Store } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ErrorAlert } from "../components/ErrorAlert";
import { initial, num, PageHeader } from "../components/PageHeader";
import { TableState } from "../components/TableState";
import { api } from "../lib/api";

/**
 * Two series everywhere on this page: master QR and shop QR. Colours checked with the dataviz
 * validator (lightness band, CVD and normal-vision separation, contrast) for both themes; dark
 * mode has its own steps, not a flip. Identity is never colour alone: legend, labels, icons.
 */
const COLORS =
  "[--qr-master:#6155f5] [--qr-shop:#22a35a] dark:[--qr-master:oklch(0.64_0.19_279.3)] dark:[--qr-shop:oklch(0.66_0.15_152.6)]";

const chartConfig = {
  master: { label: "Master QR", color: "var(--qr-master)" },
  shop: { label: "Shop QR", color: "var(--qr-shop)" },
} satisfies ChartConfig;

const PERIODS = [7, 30, 90] as const;
const pct = (part: number, total: number) =>
  total ? Math.round((part / total) * 100) : 0;

/** Platform statistics: where collects come from — the master QR or a shop's own QR. */
export function Statistics() {
  const navigate = useNavigate();
  const [days, setDays] = useState<number>(30);
  // Loaded once per period and only reloaded with the Refresh button: no reloading on window
  // focus, reconnect or a timer, so the numbers don't move while someone is reading them.
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } =
    useQuery({
      queryKey: ["qr-sources", days],
      queryFn: () => api.qrSources(days),
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    });
  const total = (data?.master.collects ?? 0) + (data?.shop.collects ?? 0);

  return (
    <div className={COLORS}>
      <PageHeader
        title="Statistics"
        subtitle="Where collects come from: the master QR (works at any shop) or a shop's own QR (made on its page in the app)."
        extra={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className="text-sm text-muted-foreground"
                aria-live="polite"
              >
                {isFetching
                  ? "Updating…"
                  : dataUpdatedAt
                    ? `Last updated ${dayjs(dataUpdatedAt).format("D MMM, HH:mm:ss")}`
                    : null}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={isFetching}
                onClick={() => void refetch()}
              >
                <RefreshCw
                  className={isFetching ? "animate-spin" : undefined}
                />{" "}
                Refresh
              </Button>
            </div>
            <ToggleGroup
              type="single"
              variant="outline"
              value={String(days)}
              onValueChange={(v) => v && setDays(Number(v))}
              aria-label="Period"
            >
              {PERIODS.map((d) => (
                <ToggleGroupItem
                  key={d}
                  value={String(d)}
                  className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {d} days
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        }
      />
      <ErrorAlert error={error} className="mb-4" />
      {isLoading || !data ? (
        error ? null : (
          <div className="grid gap-5">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        )
      ) : (
        <div className="grid gap-5">
          {/* Headline: the split, as numbers first */}
          <div className="grid gap-5 md:grid-cols-2">
            <SourceTile
              icon={<QrCode className="size-5" />}
              swatch="var(--qr-master)"
              title="Master QR"
              hint="Tab-bar QR, works at any shop"
              collects={data.master.collects}
              points={data.master.points}
              share={pct(data.master.collects, total)}
              leading={total > 0 && data.master.collects >= data.shop.collects}
            />
            <SourceTile
              icon={<Store className="size-5" />}
              swatch="var(--qr-shop)"
              title="Shop QR"
              hint="Made on a shop's page, works only there"
              collects={data.shop.collects}
              points={data.shop.points}
              share={pct(data.shop.collects, total)}
              leading={total > 0 && data.shop.collects > data.master.collects}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Share of collects · last {days} days</CardTitle>
              <CardDescription>{num(total)} collects in total</CardDescription>
            </CardHeader>
            <CardContent>
              {total === 0 ? (
                <p className="py-6 text-center text-muted-foreground">
                  No collects in this period yet.
                </p>
              ) : (
                <ShareBar
                  master={data.master.collects}
                  shop={data.shop.collects}
                  height="h-4"
                  withLabels
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Collects per day</CardTitle>
              <CardDescription>
                Each bar splits the day's collects by the QR used.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={chartConfig}
                className="aspect-auto h-[280px] w-full"
              >
                <BarChart
                  data={data.daily}
                  margin={{ top: 10, right: 8, left: -18, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) =>
                      dayjs(d).format(days > 30 ? "D MMM" : "D")
                    }
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={16}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip
                    cursor={{ fillOpacity: 0.4 }}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(d) =>
                          dayjs(String(d)).format("dddd D MMM")
                        }
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  {/* stacked from the baseline; rounded data-ends; a 2px surface gap between the segments */}
                  <Bar
                    dataKey="master"
                    stackId="qr"
                    fill="var(--color-master)"
                    stroke="var(--card)"
                    strokeWidth={2}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="shop"
                    stackId="qr"
                    fill="var(--color-shop)"
                    stroke="var(--card)"
                    strokeWidth={2}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By shop · last {days} days</CardTitle>
              <CardDescription>
                Which shops' customers use the shop QR, busiest first.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Shop</TableHead>
                      <TableHead className="text-right">Master QR</TableHead>
                      <TableHead className="text-right">Shop QR</TableHead>
                      <TableHead className="w-[32%]">Split</TableHead>
                      <TableHead className="pr-4 text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableState
                      loading={false}
                      empty={!data.vendors.length}
                      colSpan={5}
                      emptyText="No collects in this period"
                    />
                    {data.vendors.map((v) => (
                      <TableRow
                        key={v.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/merchants/${v.id}`)}
                      >
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8">
                              <AvatarImage
                                src={v.logoUrl ?? undefined}
                                alt=""
                              />
                              <AvatarFallback className="bg-brand-soft text-xs font-semibold text-accent-foreground">
                                {initial(v.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-semibold">{v.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {num(v.master)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {num(v.shop)}
                        </TableCell>
                        <TableCell>
                          <ShareBar
                            master={v.master}
                            shop={v.shop}
                            height="h-2"
                          />
                        </TableCell>
                        <TableCell className="pr-4 text-right font-semibold tabular-nums">
                          {num(v.master + v.shop)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function SourceTile({
  icon,
  swatch,
  title,
  hint,
  collects,
  points,
  share,
  leading,
}: {
  icon: ReactNode;
  swatch: string;
  title: string;
  hint: string;
  collects: number;
  points: number;
  share: number;
  leading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3.5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-accent-foreground">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span
              className="size-2.5 rounded-full"
              style={{ background: swatch }}
              aria-hidden
            />
            {title}
            {leading ? (
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                Used most
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight tabular-nums">
              {num(collects)}
            </span>
            <span className="text-sm text-muted-foreground">
              collects · {share}%
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {num(points)} points given · {hint}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** A 100% bar: master QR share, a 2px gap, shop QR share. Hover shows the exact numbers. */
function ShareBar({
  master,
  shop,
  height,
  withLabels,
}: {
  master: number;
  shop: number;
  height: string;
  withLabels?: boolean;
}) {
  const total = master + shop;
  const m = pct(master, total);
  const label = `Master QR ${num(master)} (${m}%) · Shop QR ${num(shop)} (${total ? 100 - m : 0}%)`;
  return (
    <div className="grid gap-2" title={label}>
      <div
        className={`flex ${height} w-full gap-0.5 overflow-hidden rounded-full bg-muted`}
        role="img"
        aria-label={label}
      >
        {master > 0 ? (
          <div
            className="h-full rounded-full"
            style={{ width: `${m}%`, background: "var(--qr-master)" }}
          />
        ) : null}
        {shop > 0 ? (
          <div
            className="h-full flex-1 rounded-full"
            style={{ background: "var(--qr-shop)" }}
          />
        ) : null}
      </div>
      {withLabels ? (
        <div className="flex justify-between text-sm">
          <span>
            <span className="font-semibold">Master QR {m}%</span>{" "}
            <span className="text-muted-foreground">· {num(master)}</span>
          </span>
          <span>
            <span className="font-semibold">
              Shop QR {total ? 100 - m : 0}%
            </span>{" "}
            <span className="text-muted-foreground">· {num(shop)}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
