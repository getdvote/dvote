import { useVendorApi, WorkspaceLink } from '../../lib/vendor-workspace';
import { ActivitySheet } from './MyActivity';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DownloadMinimalisticIcon as Download,
  LoaderIcon as Loader2,
  LockIcon as LockKeyhole,
  UsersGroupTwoRoundedIcon as UsersRound,
} from '@solar-icons/react/linear';
import { toast } from 'sonner';
import { useState, type ReactNode } from 'react';
import { useWorkspaceSearchParams as useSearchParams } from '../../lib/vendor-workspace';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Pager, SearchInput, SelectFilter } from '../../components/ListControls';
import { num, PageHeader } from '../../components/PageHeader';
import { useMe, useMyScope, useMyVendor } from '../../layouts/VendorLayout';
import { errorMessage, type CustomerSegment, type CustomSegment, type MerchantCustomer, type MerchantCustomerQuery } from '../../lib/api';
import { localeOf, t } from '../../i18n';
import { formatEgyptianMobile } from '../../lib/phone';
import { BrandIllustration } from '../../components/BrandArt';
import { CustomSegmentBadge, exportCustomers, SegmentBadge, segmentLabel, Segmentation, SEGMENTS, segmentText } from './customer-segments';
import { PlanChip } from '../../components/plan-lock';
import { WorkspaceLink as Link } from '../../lib/vendor-workspace';
import { useHasFeature } from '../../lib/entitlements';

const PAGE_SIZE = 25;
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(localeOf(), {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Africa/Cairo',
      }).format(new Date(value))
    : t('customers.segments.never_visited.label');
const time = (value: string) =>
  new Intl.DateTimeFormat(localeOf(), {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Cairo',
  }).format(new Date(value));
const cash = (value: string, currency: string) =>
  new Intl.NumberFormat(localeOf(), {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
const displayName = (c: MerchantCustomer) => c.name?.trim() || t('customers.fallbackName', { ref: c.reference });

/** Merchant customer directory. URL state preserves filters, paging and the open profile. */
export function MyCustomers() {
  const vendorApi = useVendorApi();
  const me = useMe();
  const vendor = useMyVendor();
  const scope = useMyScope();
  const [params, setParams] = useSearchParams();
  const manager = me.branchId !== null; // branch-scoped (branch manager); admins and viewers see every branch
  const isAdmin = me.role === 'vendor_admin';
  const branchId = manager ? (me.branchId ?? undefined) : params.get('branch') || undefined;
  const segment = SEGMENTS.find((s) => s.key === params.get('segment'))?.key;
  const customSegment = params.get('custom') || undefined;
  const sort = (['recent', 'spend', 'visits', 'name'].includes(params.get('sort') ?? '') ? params.get('sort') : 'recent') as NonNullable<
    MerchantCustomerQuery['sort']
  >;
  const pageValue = Number(params.get('page') ?? 1);
  const page = Number.isInteger(pageValue) && pageValue > 0 && pageValue <= 100000 ? pageValue : 1;
  const search = params.get('search') ?? '';
  const customerId = params.get('customer');
  const query = {
    branchId,
    segment,
    customSegment,
    sort,
    search,
    page,
    pageSize: PAGE_SIZE,
  };
  const [exporting, setExporting] = useState(false);
  const canExport = useHasFeature('customer_export');
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['merchant-customers', me.id, vendor.id, query],
    queryFn: () => vendorApi.customers(query),
    refetchInterval: 60_000,
  });
  const { data: branches } = useQuery({
    queryKey: ['branches', scope.key],
    queryFn: scope.branches,
    enabled: !manager,
  });
  const scopeName = manager ? (me.branch?.name ?? t('availability.yourBranch')) : (branches?.find((b) => b.id === branchId)?.name ?? vendor.name);
  const set = (key: string, value?: string, resetPage = true) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        if (resetPage) next.delete('page');
        if (key === 'branch') next.delete('customer');
        return next;
      },
      { replace: key === 'search' },
    );
  };
  const count = (key: CustomerSegment) => data?.segments.find((s) => s.key === key)?.count ?? 0;
  const view = params.get('view') === 'segmentation' ? 'segmentation' : 'customers';
  const showView = (v: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (v === 'segmentation') next.set('view', v);
      else next.delete('view');
      return next;
    });
  /** From Segmentation: the list, filtered to one segment (built-in or custom). */
  const seeSegment = (key: string, kind: 'segment' | 'custom') =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('view');
      next.delete('page');
      next.delete('segment');
      next.delete('custom');
      next.set(kind, key);
      return next;
    });
  /** The segment filter: "all", a built-in key, or "custom:<id>". */
  const filterValue = customSegment ? `custom:${customSegment}` : (segment ?? 'all');
  const setFilter = (v: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('page');
      next.delete('segment');
      next.delete('custom');
      if (v.startsWith('custom:')) next.set('custom', v.slice(7));
      else if (v !== 'all') next.set('segment', v);
      return next;
    });
  const filtered = !!(segment || customSegment);
  const exportList = () => {
    setExporting(true);
    const label = segment ? segmentLabel(segment) : (data?.customSegments.find((x) => x.id === customSegment)?.name ?? 'all');
    exportCustomers({ branchId, segment, customSegment, sort, search }, label, vendorApi)
      .catch((e: unknown) => void toast.error(errorMessage(e)))
      .finally(() => setExporting(false));
  };

  return (
    <>
      <PageHeader title={t('nav.customers')} subtitle={t('customers.subtitle', { scope: scopeName })} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('customers.segmentsAuto')}</p>
        {!manager && (
          <SelectFilter
            label={t('common.branch')}
            allLabel={t('common.allBranches')}
            value={branchId ?? 'all'}
            onChange={(v) => set('branch', v === 'all' ? undefined : v)}
            options={branches?.map((b) => ({ value: b.id, label: b.name }))}
          />
        )}
      </div>
      <Tabs value={view} onValueChange={showView}>
        <TabsList className="mb-4">
          <TabsTrigger value="customers">{t('customers.tabList')}</TabsTrigger>
          <TabsTrigger value="segmentation">{t('customers.tabSegments')}</TabsTrigger>
        </TabsList>
        <TabsContent value="segmentation">
          <Segmentation
            data={data}
            branchId={branchId}
            canEdit={isAdmin}
            onSee={(key) => seeSegment(key, 'segment')}
            onSeeCustom={(id) => seeSegment(id, 'custom')}
          />
        </TabsContent>
        <TabsContent value="customers">
          <ErrorAlert error={error} className="mb-4" />
          {error ? (
            <Button variant="outline" onClick={() => void refetch()}>
              {t('customers.tryAgain')}
            </Button>
          ) : (
            <>
              <Card className="gap-0 py-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                  <Select value={filterValue} onValueChange={setFilter}>
                    <SelectTrigger aria-label={t('customers.segment')} className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t('customers.all')}
                        {data ? ` (${num(data.customersTotal)})` : ''}
                      </SelectItem>
                      <SelectGroup>
                        <SelectLabel>{t('customers.filterBuiltIn')}</SelectLabel>
                        {SEGMENTS.map((x) => (
                          <SelectItem key={x.key} value={x.key}>
                            {segmentLabel(x.key)}
                            {data ? ` (${num(count(x.key))})` : ''}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      {data?.customSegments.length ? (
                        <SelectGroup>
                          <SelectLabel>{t('customers.filterCustom')}</SelectLabel>
                          {data.customSegments.map((x) => (
                            <SelectItem key={x.id} value={`custom:${x.id}`}>
                              {x.name} ({num(x.count)})
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ) : null}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-muted-foreground">{data ? t('customers.matching', { n: data.total }) : t('customers.loading')}</p>
                    {isAdmin &&
                      (canExport ? (
                        <Button variant="outline" size="sm" disabled={exporting || !data?.total} onClick={exportList}>
                          {exporting ? <Loader2 className="animate-spin" /> : <Download />}
                          {t('customers.exportList')}
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/settings?tab=billing">
                            <Download />
                            {t('customers.exportList')}
                            <PlanChip feature="customer_export" />
                          </Link>
                        </Button>
                      ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <SearchInput value={search} onChange={(v) => set('search', v.slice(0, 120) || undefined)} placeholder={t('customers.search')} />
                  <Select value={sort} onValueChange={(v) => set('sort', v)}>
                    <SelectTrigger aria-label={t('customers.sort')} className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">{t('customers.sorts.recent')}</SelectItem>
                      <SelectItem value="spend">{t('customers.sorts.spend')}</SelectItem>
                      <SelectItem value="visits">{t('customers.sorts.visits')}</SelectItem>
                      <SelectItem value="name">{t('customers.sorts.name')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isPending ? (
                  <div className="space-y-3 p-4" aria-label={t('customers.loading')}>
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : !data?.items.length ? (
                  <div className="px-4 py-12 text-center">
                    {search || filtered || page > 1 ? (
                      <UsersRound className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden />
                    ) : (
                      <BrandIllustration name="invite-customers" size="sm" className="mx-auto mb-3" />
                    )}
                    <h2 className="font-semibold">
                      {search || filtered ? t('customers.noMatch') : page > 1 ? t('customers.noPage') : t('customers.emptyTitle')}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">{search || filtered ? t('customers.noMatchText') : t('customers.emptyText')}</p>
                    {search || filtered || page > 1 ? (
                      <Button variant="outline" className="mt-4" onClick={() => setParams(branchId && !manager ? { branch: branchId } : {})}>
                        {t('customers.reset')}
                      </Button>
                    ) : (
                      <Button variant="outline" className="mt-4" asChild>
                        <WorkspaceLink to="/card">{t('emptyStates.shareCard')}</WorkspaceLink>
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="hidden overflow-x-auto md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="ps-4">{t('activity.customer')}</TableHead>
                            <TableHead>{t('customers.segment')}</TableHead>
                            <TableHead>{t('customers.lastVisit')}</TableHead>
                            <TableHead className="text-end">{t('insights.kpi.visits')}</TableHead>
                            <TableHead className="text-end">{t('customers.spend')}</TableHead>
                            <TableHead className="pe-4 text-end">{t('customers.rewardsRedeemed')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.items.map((c) => (
                            <TableRow
                              key={c.id}
                              className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                              tabIndex={0}
                              onClick={(e) => {
                                if (!(e.target as HTMLElement).closest('button,a')) set('customer', c.id, false);
                              }}
                              onKeyDown={(e) => {
                                if (e.target !== e.currentTarget) return;
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  set('customer', c.id, false);
                                }
                              }}
                            >
                              <TableCell className="ps-4">
                                <CustomerButton customer={c} onClick={() => set('customer', c.id, false)} />
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1.5">
                                  <SegmentBadge segment={c.segment} />
                                  {c.customSegment && <CustomSegmentBadge name={c.customSegment.name} />}
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{date(c.lastVisitAt)}</TableCell>
                              <TableCell className="text-end tabular-nums">{num(c.visits)}</TableCell>
                              <TableCell className="text-end font-medium tabular-nums">{cash(c.spend, vendor.currency)}</TableCell>
                              <TableCell className="pe-4 text-end tabular-nums">{num(c.rewardsRedeemed)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="divide-y md:hidden">
                      {data.items.map((c) => (
                        <div
                          key={c.id}
                          className="cursor-pointer space-y-3 p-4 hover:bg-muted"
                          onClick={(e) => {
                            if (!(e.target as HTMLElement).closest('button,a')) set('customer', c.id, false);
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <CustomerButton customer={c} onClick={() => set('customer', c.id, false)} />
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <SegmentBadge segment={c.segment} />
                              {c.customSegment && <CustomSegmentBadge name={c.customSegment.name} />}
                            </div>
                          </div>
                          <div className="flex flex-wrap justify-between gap-2 text-sm">
                            <span>
                              {t('customers.visitsN', { n: c.visits })} · {cash(c.spend, vendor.currency)}
                            </span>
                            <span className="text-muted-foreground">
                              {t('customers.last', {
                                date: date(c.lastVisitAt),
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onChange={(p) => set('page', String(p), false)} />
              </Card>
            </>
          )}
          <div className="mt-4 flex flex-wrap justify-between gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <LockKeyhole className="size-3.5" aria-hidden /> {t('customers.private')}
            </span>
            {data && (
              <span>
                {t(branchId ? 'customers.asOfOnly' : 'customers.asOf', {
                  date: data.asOf,
                  scope: scopeName,
                })}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t('customers.footnote')}</p>
        </TabsContent>
      </Tabs>
      <Sheet open={!!customerId} onOpenChange={(open) => !open && set('customer', undefined, false)}>
        <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=left]:w-full data-[side=right]:sm:max-w-xl data-[side=left]:sm:max-w-xl">
          {customerId && (
            <CustomerProfile
              key={`${customerId}:${branchId ?? ''}`}
              id={customerId}
              branchId={branchId}
              currency={vendor.currency}
              scopeName={scopeName}
              segments={data?.customSegments ?? []}
              canEdit={isAdmin}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function CustomerButton({ customer: c, onClick }: { customer: MerchantCustomer; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-md text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Avatar className="size-9">
        <AvatarFallback className="bg-secondary text-accent-foreground">{c.name?.trim().slice(0, 1).toUpperCase() || '?'}</AvatarFallback>
      </Avatar>
      <span>
        <span className="block font-medium hover:underline">{displayName(c)}</span>
        <span className="font-mono text-xs text-muted-foreground">#{c.reference}</span>
      </span>
    </button>
  );
}

function CustomerProfile({
  id,
  branchId,
  currency,
  scopeName,
  segments,
  canEdit,
}: {
  id: string;
  branchId?: string;
  currency: string;
  scopeName: string;
  segments: CustomSegment[];
  canEdit: boolean;
}) {
  const vendorApi = useVendorApi();
  const me = useMe();
  const [page, setPage] = useState(1);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['merchant-customer', me.id, me.vendor.id, id, branchId, page],
    queryFn: () => vendorApi.customer(id, { branchId, page, pageSize: 10 }),
    refetchInterval: 60_000,
  });
  const [eventId, setEventId] = useState<string | null>(null);
  const event = useQuery({
    queryKey: ['customer-activity-detail', me.vendor.id, eventId],
    queryFn: () => vendorApi.events({ eventId: eventId!, pageSize: 1 }),
    enabled: !!eventId,
  });
  const c = data?.customer;
  return (
    <>
      <SheetHeader className="border-b pe-12">
        <SheetTitle>{c ? displayName(c) : t('customers.profile')}</SheetTitle>
        <SheetDescription>
          {t(branchId ? 'customers.relationOnly' : 'customers.relation', {
            scope: scopeName,
          })}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-6 p-4">
        {error ? (
          <>
            <ErrorAlert error={error} />
            <Button variant="outline" onClick={() => void refetch()}>
              {t('customers.tryAgain')}
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
                  <AvatarFallback>{c.name?.trim()[0]?.toUpperCase() || '?'}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="mb-1 font-mono text-xs text-muted-foreground">#{c.reference}</p>
                  <SegmentBadge segment={c.segment} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{segmentText(c.segment)}</p>
              <CustomSegmentPicker customer={c} segments={segments} canEdit={canEdit} />
              <dl className="grid grid-cols-2 gap-3">
                <Metric label={t('customers.spend')}>{cash(c.spend, currency)}</Metric>
                <Metric label={t('insights.kpi.avgBill')}>{cash(c.averageBill, currency)}</Metric>
                <Metric label={t('customers.lifetimeVisits')}>{num(c.visits)}</Metric>
                <Metric label={t('customers.visits90')}>{num(c.visits90d)}</Metric>
                <Metric label={t('customers.rewardsRedeemed')}>{num(c.rewardsRedeemed)}</Metric>
                <Metric label={t('customers.balance')}>{c.pointsBalance === null ? t('customers.balanceHidden') : num(c.pointsBalance)}</Metric>
              </dl>
              <dl className="divide-y text-sm">
                <Info label={t('customers.firstPurchase')}>{date(c.firstVisitAt)}</Info>
                <Info label={t('customers.lastPurchase')}>{date(c.lastVisitAt)}</Info>
                {/* email stays in the database but isn't shown: phone is the contact from now on */}
                <Info label={t('customers.phone')}>
                  {c.phone ? (
                    <a dir="ltr" href={`tel:${c.phone}`} className="font-medium tabular-nums hover:underline">
                      {formatEgyptianMobile(c.phone)}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </Info>
              </dl>
              <section aria-label={t('customers.history')}>
                <h3 className="font-semibold">{t('customers.history')}</h3>
                <p className="mb-3 text-xs text-muted-foreground">{t('customers.events', { n: data.total, scope: scopeName })}</p>
                {data.events.length ? (
                  <ol className="divide-y">
                    {data.events.map((e) => (
                      <li key={e.id} className="py-1">
                        <button
                          type="button"
                          onClick={() => setEventId(e.id)}
                          className="flex w-full justify-between gap-3 rounded-lg px-3 py-3 text-start transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {e.type === 'earn'
                                ? t('customers.collected')
                                : e.type === 'redeem'
                                  ? (e.rewardName ?? t('customers.redeemed'))
                                  : t('customers.corrected')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {date(e.createdAt)} · {time(e.createdAt)}
                              {e.branchName ? ` · ${e.branchName}` : ''}
                            </p>
                            {e.amount !== null && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {t('customers.bill', {
                                  amount: cash(e.amount, currency),
                                })}
                              </p>
                            )}
                          </div>
                          <span dir="ltr" className="whitespace-nowrap text-sm font-semibold tabular-nums">
                            {e.points > 0 ? '+' : ''}
                            {num(e.points)} {t('branding.pts')}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="py-6 text-sm text-muted-foreground">{t('customers.noHistory')}</p>
                )}
                <Pager page={page} pageSize={10} total={data.total} onChange={setPage} />
              </section>
            </>
          )
        )}
        {eventId && event.isFetching ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t('common.loading')}
          </p>
        ) : null}
        {eventId ? <ErrorAlert error={event.error} /> : null}
        {eventId && event.isSuccess && !event.data.items.length ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t('activity.noMatch')}
          </p>
        ) : null}
      </div>
      <ActivitySheet item={eventId ? (event.data?.items[0] ?? null) : null} currency={currency} onClose={() => setEventId(null)} />
    </>
  );
}
const Metric = ({ label, children }: { label: string; children: ReactNode }) => (
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

/** The customer's own segment (at most one): shown to everyone, changed by hand by merchant admins. */
function CustomSegmentPicker({ customer: c, segments, canEdit }: { customer: MerchantCustomer; segments: CustomSegment[]; canEdit: boolean }) {
  const vendorApi = useVendorApi();
  const qc = useQueryClient();
  const NONE = 'none';
  const change = useMutation({
    mutationFn: (to: string) => (to === NONE ? vendorApi.removeSegmentMember(c.customSegment!.id, c.id) : vendorApi.addSegmentMember(to, c.id)),
    onSuccess: async () => {
      toast.success(t('customers.segmentUpdated'));
      await Promise.all([qc.invalidateQueries({ queryKey: ['merchant-customer'] }), qc.invalidateQueries({ queryKey: ['merchant-customers'] })]);
    },
    onError: (e) => void toast.error(errorMessage(e)),
  });
  if (!canEdit && !c.customSegment) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{t('customers.customSegment')}</p>
        {c.customSegment ? (
          <p className="text-sm">
            <span className="font-medium">{c.customSegment.name}</span>
            <span className="text-muted-foreground">
              {' · '}
              {c.customSegment.manual ? t('customers.manual') : t('customers.byRules')}
            </span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t('customers.noCustomSegment')}</p>
        )}
      </div>
      {canEdit && segments.length > 0 && (
        <Select value={c.customSegment?.id ?? NONE} disabled={change.isPending} onValueChange={(v) => change.mutate(v)}>
          <SelectTrigger size="sm" className="w-44" aria-label={t('customers.customSegment')}>
            {change.isPending ? <Loader2 className="animate-spin" /> : null}
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {c.customSegment && <SelectItem value={NONE}>{t('customers.removeFromSegment')}</SelectItem>}
            {segments.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
