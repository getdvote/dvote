import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, LockKeyhole, UsersRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorAlert } from "../../components/ErrorAlert";
import {
  Pager,
  SearchInput,
  SelectFilter,
} from "../../components/ListControls";
import { num, PageHeader } from "../../components/PageHeader";
import { useMe, useMyScope, useMyVendor } from "../../layouts/VendorLayout";
import {
  vendorApi,
  type CustomerSegment,
  type MerchantCustomer,
  type MerchantCustomerQuery,
} from "../../lib/api";
import { cn } from "@/lib/utils";

const SEGMENTS: {
  key: CustomerSegment;
  label: string;
  description: string;
  variant: "brand" | "success" | "warning" | "secondary";
}[] = [
  {
    key: "new",
    label: "New",
    description: "First purchase in the last 30 days.",
    variant: "brand",
  },
  {
    key: "returning",
    label: "Returning",
    description:
      "First purchase over 30 days ago; visited recently, with fewer than 5 purchases in 90 days.",
    variant: "secondary",
  },
  {
    key: "regular",
    label: "Regulars",
    description:
      "First purchase over 30 days ago; 5+ purchases in 90 days and a visit in the last 30 days.",
    variant: "success",
  },
  {
    key: "at_risk",
    label: "At risk",
    description: "No purchase in the last 30 days.",
    variant: "warning",
  },
  {
    key: "no_visits",
    label: "No visits yet",
    description: "A loyalty card without a recorded purchase.",
    variant: "secondary",
  },
];
const PAGE_SIZE = 25;
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Africa/Cairo",
      }).format(new Date(value))
    : "No visits yet";
const time = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Cairo",
  }).format(new Date(value));
const cash = (value: string, currency: string) =>
  new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
const displayName = (c: MerchantCustomer) =>
  c.name?.trim() || `Customer #${c.reference}`;

function SegmentBadge({ segment }: { segment: CustomerSegment }) {
  const s = SEGMENTS.find((item) => item.key === segment)!;
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

/** Merchant customer directory. URL state preserves filters, paging and the open profile. */
export function MyCustomers() {
  const me = useMe();
  const vendor = useMyVendor();
  const scope = useMyScope();
  const [params, setParams] = useSearchParams();
  const manager = me.role !== "vendor_admin";
  const branchId = manager
    ? (me.branchId ?? undefined)
    : params.get("branch") || undefined;
  const segment = SEGMENTS.find((s) => s.key === params.get("segment"))?.key;
  const sort = (
    ["recent", "spend", "visits", "name"].includes(params.get("sort") ?? "")
      ? params.get("sort")
      : "recent"
  ) as NonNullable<MerchantCustomerQuery["sort"]>;
  const pageValue = Number(params.get("page") ?? 1);
  const page =
    Number.isInteger(pageValue) && pageValue > 0 && pageValue <= 100000
      ? pageValue
      : 1;
  const search = params.get("search") ?? "";
  const customerId = params.get("customer");
  const query = { branchId, segment, sort, search, page, pageSize: PAGE_SIZE };
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["merchant-customers", me.id, vendor.id, query],
    queryFn: () => vendorApi.customers(query),
    refetchInterval: 60_000,
  });
  const { data: branches } = useQuery({
    queryKey: ["branches", scope.key],
    queryFn: scope.branches,
    enabled: !manager,
  });
  const scopeName = manager
    ? (me.branch?.name ?? "your branch")
    : (branches?.find((b) => b.id === branchId)?.name ?? vendor.name);
  const set = (key: string, value?: string, resetPage = true) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        if (resetPage) next.delete("page");
        if (key === "branch") next.delete("customer");
        return next;
      },
      { replace: key === "search" },
    );
  };
  const count = (key: CustomerSegment) =>
    data?.segments.find((s) => s.key === key)?.count ?? 0;

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={`Get to know the people who visit ${scopeName}.`}
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Segments update automatically from purchases recorded through dvote.
        </p>
        {!manager && (
          <SelectFilter
            label="Branch"
            allLabel="All branches"
            value={branchId ?? "all"}
            onChange={(v) => set("branch", v === "all" ? undefined : v)}
            options={branches?.map((b) => ({ value: b.id, label: b.name }))}
          />
        )}
      </div>
      <ErrorAlert error={error} className="mb-4" />
      {error ? (
        <Button variant="outline" onClick={() => void refetch()}>
          Try again
        </Button>
      ) : (
        <>
          <div
            className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Customer segments"
          >
            {SEGMENTS.slice(0, 4).map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={segment === s.key}
                onClick={() =>
                  set("segment", segment === s.key ? undefined : s.key)
                }
                className={cn(
                  "rounded-xl border bg-card p-4 text-start transition-colors duration-100 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  segment === s.key && "border-primary bg-accent",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.label}</span>
                  <ArrowUpRight
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                </div>
                <div className="my-2 flex items-baseline gap-2">
                  {data ? (
                    <>
                      <span className="text-3xl font-semibold tabular-nums">
                        {num(count(s.key))}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {data.customersTotal
                          ? Math.round(
                              (count(s.key) / data.customersTotal) * 100,
                            )
                          : 0}
                        % of customers
                      </span>
                    </>
                  ) : (
                    <Skeleton className="h-9 w-20" />
                  )}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {s.description}
                </p>
              </button>
            ))}
          </div>
          <Card className="gap-0 py-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={!segment ? "secondary" : "ghost"}
                  aria-pressed={!segment}
                  onClick={() => set("segment")}
                >
                  <UsersRound /> All customers{" "}
                  {data && (
                    <Badge variant="outline">{num(data.customersTotal)}</Badge>
                  )}
                </Button>
                {(count("no_visits") > 0 || segment === "no_visits") && (
                  <Button
                    variant={segment === "no_visits" ? "secondary" : "ghost"}
                    onClick={() => set("segment", "no_visits")}
                  >
                    No visits yet ({count("no_visits")})
                  </Button>
                )}
                {segment && segment !== "no_visits" && (
                  <Badge variant="brand">
                    {SEGMENTS.find((s) => s.key === segment)?.label}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {data
                  ? `${num(data.total)} matching customers`
                  : "Loading customers…"}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <SearchInput
                value={search}
                onChange={(v) => set("search", v.slice(0, 120) || undefined)}
                placeholder="Search name or card reference"
              />
              <Select value={sort} onValueChange={(v) => set("sort", v)}>
                <SelectTrigger aria-label="Sort customers" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most recent visit</SelectItem>
                  <SelectItem value="spend">Highest recorded spend</SelectItem>
                  <SelectItem value="visits">Most visits</SelectItem>
                  <SelectItem value="name">Name A–Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isPending ? (
              <div className="space-y-3 p-4" aria-label="Loading customers">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !data?.items.length ? (
              <div className="px-4 py-12 text-center">
                <UsersRound
                  className="mx-auto mb-3 size-8 text-muted-foreground"
                  aria-hidden
                />
                <h2 className="font-semibold">
                  {search || segment
                    ? "No customers match these filters"
                    : page > 1
                      ? "No customers on this page"
                      : "Your customer list starts with a visit"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search || segment
                    ? "Try another name or view all customers."
                    : "Customers appear here when they collect points at your shop."}
                </p>
                {(search || segment || page > 1) && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() =>
                      setParams(
                        branchId && !manager ? { branch: branchId } : {},
                      )
                    }
                  >
                    Reset filters
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="ps-4">Customer</TableHead>
                        <TableHead>Segment</TableHead>
                        <TableHead>Last visit</TableHead>
                        <TableHead className="text-end">Visits</TableHead>
                        <TableHead className="text-end">
                          Recorded spend
                        </TableHead>
                        <TableHead className="pe-4 text-end">
                          Rewards redeemed
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="ps-4">
                            <CustomerButton
                              customer={c}
                              onClick={() => set("customer", c.id, false)}
                            />
                          </TableCell>
                          <TableCell>
                            <SegmentBadge segment={c.segment} />
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {date(c.lastVisitAt)}
                          </TableCell>
                          <TableCell className="text-end tabular-nums">
                            {num(c.visits)}
                          </TableCell>
                          <TableCell className="text-end font-medium tabular-nums">
                            {cash(c.spend, vendor.currency)}
                          </TableCell>
                          <TableCell className="pe-4 text-end tabular-nums">
                            {num(c.rewardsRedeemed)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="divide-y md:hidden">
                  {data.items.map((c) => (
                    <div key={c.id} className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <CustomerButton
                          customer={c}
                          onClick={() => set("customer", c.id, false)}
                        />
                        <SegmentBadge segment={c.segment} />
                      </div>
                      <div className="flex flex-wrap justify-between gap-2 text-sm">
                        <span>
                          {num(c.visits)} visits ·{" "}
                          {cash(c.spend, vendor.currency)}
                        </span>
                        <span className="text-muted-foreground">
                          Last: {date(c.lastVisitAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <Pager
              page={page}
              pageSize={PAGE_SIZE}
              total={data?.total ?? 0}
              onChange={(p) => set("page", String(p), false)}
            />
          </Card>
        </>
      )}
      <div className="mt-4 flex flex-wrap justify-between gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <LockKeyhole className="size-3.5" aria-hidden /> Phone numbers and
          emails stay private.
        </span>
        {data && (
          <span>
            As of {data.asOf} · Cairo time · Counts cover {scopeName}
            {branchId ? " only" : ""}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Each customer belongs to one segment. Recent means the last 30 Cairo
        calendar days. Visits and spend are lifetime totals in the selected
        scope; a visit is one recorded purchase.
      </p>
      <Sheet
        open={!!customerId}
        onOpenChange={(open) => !open && set("customer", undefined, false)}
      >
        <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
          {customerId && (
            <CustomerProfile
              key={`${customerId}:${branchId ?? ""}`}
              id={customerId}
              branchId={branchId}
              currency={vendor.currency}
              scopeName={scopeName}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function CustomerButton({
  customer: c,
  onClick,
}: {
  customer: MerchantCustomer;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-md text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Avatar className="size-9">
        <AvatarFallback className="bg-brand-soft text-accent-foreground">
          {c.name?.trim().slice(0, 1).toUpperCase() || "?"}
        </AvatarFallback>
      </Avatar>
      <span>
        <span className="block font-medium hover:underline">
          {displayName(c)}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          #{c.reference}
        </span>
      </span>
    </button>
  );
}

function CustomerProfile({
  id,
  branchId,
  currency,
  scopeName,
}: {
  id: string;
  branchId?: string;
  currency: string;
  scopeName: string;
}) {
  const me = useMe();
  const [page, setPage] = useState(1);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["merchant-customer", me.id, me.vendor.id, id, branchId, page],
    queryFn: () => vendorApi.customer(id, { branchId, page, pageSize: 10 }),
    refetchInterval: 60_000,
  });
  const c = data?.customer;
  return (
    <>
      <SheetHeader className="border-b pe-12">
        <SheetTitle>{c ? displayName(c) : "Customer profile"}</SheetTitle>
        <SheetDescription>
          Loyalty relationship with {scopeName}
          {branchId ? " only" : ""}.
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-6 p-4">
        {error ? (
          <>
            <ErrorAlert error={error} />
            <Button variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
          </>
        ) : isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-36 w-full" />
          </div>
        ) : (
          c && (
            <>
              <div className="flex items-center gap-3">
                <Avatar className="size-12">
                  <AvatarFallback>
                    {c.name?.trim()[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="mb-1 font-mono text-xs text-muted-foreground">
                    #{c.reference}
                  </p>
                  <SegmentBadge segment={c.segment} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {SEGMENTS.find((s) => s.key === c.segment)?.description}
              </p>
              <dl className="grid grid-cols-2 gap-3">
                <Metric label="Recorded spend">
                  {cash(c.spend, currency)}
                </Metric>
                <Metric label="Average bill">
                  {cash(c.averageBill, currency)}
                </Metric>
                <Metric label="Lifetime visits">{num(c.visits)}</Metric>
                <Metric label="Visits · last 90 days">
                  {num(c.visits90d)}
                </Metric>
                <Metric label="Rewards redeemed">
                  {num(c.rewardsRedeemed)}
                </Metric>
                <Metric label="Points balance">
                  {c.pointsBalance === null
                    ? "Merchant-wide · hidden"
                    : num(c.pointsBalance)}
                </Metric>
              </dl>
              <dl className="divide-y text-sm">
                <Info label="First purchase">{date(c.firstVisitAt)}</Info>
                <Info label="Last purchase">{date(c.lastVisitAt)}</Info>
                <Info label="Email">
                  <Hidden />
                </Info>
                <Info label="Phone">
                  <Hidden />
                </Info>
              </dl>
              <section aria-label="Loyalty history">
                <h3 className="font-semibold">Loyalty history</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  {num(data.total)} events · {scopeName} · Cairo time
                </p>
                {data.events.length ? (
                  <ol className="divide-y">
                    {data.events.map((e) => (
                      <li
                        key={e.id}
                        className="flex justify-between gap-3 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {e.type === "earn"
                              ? "Points collected"
                              : e.type === "redeem"
                                ? (e.rewardName ?? "Reward redeemed")
                                : "Points corrected"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {date(e.createdAt)} · {time(e.createdAt)}
                            {e.branchName ? ` · ${e.branchName}` : ""}
                          </p>
                          {e.amount !== null && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Bill {cash(e.amount, currency)}
                            </p>
                          )}
                        </div>
                        <span className="whitespace-nowrap text-sm font-semibold tabular-nums">
                          {e.points > 0 ? "+" : ""}
                          {num(e.points)} pts
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="py-6 text-sm text-muted-foreground">
                    No loyalty activity recorded yet.
                  </p>
                )}
                <Pager
                  page={page}
                  pageSize={10}
                  total={data.total}
                  onChange={setPage}
                />
              </section>
            </>
          )
        )}
      </div>
    </>
  );
}
const Hidden = () => (
  <span className="flex items-center gap-1.5 text-muted-foreground">
    <LockKeyhole className="size-3.5" aria-hidden /> Private
  </span>
);
const Metric = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="rounded-lg border p-3">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="mt-1 font-semibold tabular-nums">{children}</dd>
  </div>
);
const Info = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-center justify-between gap-3 py-3">
    <dt className="text-muted-foreground">{label}</dt>
    <dd>{children}</dd>
  </div>
);
