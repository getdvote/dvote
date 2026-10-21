import { useVendorApi, WorkspaceLink } from '../../lib/vendor-workspace';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { GiftIcon as Gift, CloseIcon as X } from '@solar-icons/react/linear';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Pager, SelectFilter } from '../../components/ListControls';
import { num, PageHeader } from '../../components/PageHeader';
import { PeriodPicker, Total, usePeriod } from '../../components/PeriodFilter';
import { TableState } from '../../components/TableState';
import { useMe, useMyScope, useMyVendor } from '../../layouts/VendorLayout';
import { type RedemptionPage } from '../../lib/api';
import { cn } from '@/lib/utils';
import { t } from '../../i18n';

const PAGE_SIZE = 25;
const ALL = 'all';

/** Rewards given at my shops (a tab of the Rewards page when `embedded`): what customers pick, where, and who handed it over. Customers show as a card code. */
export function MyRedemptions({ embedded }: { embedded?: boolean } = {}) {
  const vendorApi = useVendorApi();
  const me = useMe();
  const scope = useMyScope();
  const vendor = useMyVendor();
  const branchOnly = me.branchId !== null; // branch roles; admins and viewers see every branch

  const period = usePeriod('30d');
  const [rewardId, setRewardId] = useState(ALL);
  const [branchId, setBranchId] = useState(ALL);
  const [staffId, setStaffId] = useState(ALL);
  const [page, setPage] = useState(1);

  const query = {
    ...period.dates,
    rewardId: rewardId === ALL ? undefined : rewardId,
    branchId: branchOnly || branchId === ALL ? undefined : branchId,
    staffId: staffId === ALL ? undefined : staffId,
    page,
    pageSize: PAGE_SIZE,
  };
  const { data, isLoading, error } = useQuery({
    queryKey: ['redemptions', 'me', query],
    queryFn: () => vendorApi.redemptions(query),
    placeholderData: (prev) => prev,
    refetchInterval: 60_000,
  });
  const { data: branches } = useQuery({
    queryKey: ['branches', scope.key],
    queryFn: () => scope.branches(),
    enabled: !branchOnly,
  });
  const { data: staff } = useQuery({
    queryKey: ['staff', scope.key],
    queryFn: () => scope.staff(),
  });

  // any filter change starts again at page 1
  const reset = (set: (v: string) => void) => (v: string) => {
    set(v);
    setPage(1);
  };

  const totals = data?.totals;
  const top = data?.byReward[0];
  const filtered = rewardId !== ALL || branchId !== ALL || staffId !== ALL;
  const clearFilters = () => {
    setRewardId(ALL);
    setBranchId(ALL);
    setStaffId(ALL);
    setPage(1);
  };

  return (
    <>
      {embedded ? (
        <p className="mb-4 text-sm text-muted-foreground">
          {t('redemptions.subtitle', {
            shop: branchOnly ? (me.branch?.name ?? t('availability.yourBranch')) : vendor.name,
          })}
        </p>
      ) : (
        <PageHeader
          title={t('nav.redemptions')}
          subtitle={t('redemptions.subtitle', {
            shop: branchOnly ? (me.branch?.name ?? t('availability.yourBranch')) : vendor.name,
          })}
        />
      )}
      <PeriodPicker state={period} onChange={() => setPage(1)} />

      <Card className="mb-5 flex-row flex-wrap gap-0 divide-x py-0">
        <Total label={t('redemptions.given')} value={totals ? num(totals.redemptions) : null} />
        <Total label={t('activity.pointsRedeemed')} value={totals ? num(totals.points) : null} />
        <Total label={t('redemptions.customers')} value={totals ? num(totals.customers) : null} hint={t('redemptions.customersHint')} />
        <Total label={t('redemptions.popular')} value={data ? (top?.name ?? '—') : null} />
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <ByReward data={data} selected={rewardId} onSelect={reset(setRewardId)} />

        <Card className="gap-0 py-0">
          <div className="flex flex-wrap gap-3 p-4">
            <SelectFilter
              label={t('rewards.reward')}
              allLabel={t('redemptions.allRewards')}
              value={rewardId}
              onChange={reset(setRewardId)}
              options={data?.byReward.map((r) => ({
                value: r.rewardId,
                label: r.name,
              }))}
            />
            {branchOnly ? null : (
              <SelectFilter
                label={t('common.branch')}
                allLabel={t('common.allBranches')}
                value={branchId}
                onChange={reset(setBranchId)}
                options={branches?.map((b) => ({ value: b.id, label: b.name }))}
              />
            )}
            <SelectFilter
              label={t('redemptions.givenBy')}
              allLabel={t('activity.allStaff')}
              value={staffId}
              onChange={reset(setStaffId)}
              options={staff?.map((m) => ({ value: m.id, label: m.name }))}
            />
          </div>
          <ErrorAlert error={error} className="mx-4 mb-4 w-auto" />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-4">{t('activity.time')}</TableHead>
                  <TableHead data-card="primary">{t('rewards.reward')}</TableHead>
                  <TableHead className="text-end">{t('common.points')}</TableHead>
                  {branchOnly ? null : <TableHead>{t('common.branch')}</TableHead>}
                  <TableHead>{t('redemptions.givenBy')}</TableHead>
                  <TableHead className="pe-4">{t('activity.customer')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableState
                  loading={isLoading}
                  empty={!data?.items.length}
                  colSpan={branchOnly ? 5 : 6}
                  emptyTitle={filtered ? t('emptyStates.noMatchTitle') : t('emptyStates.redemptionsTitle')}
                  emptyText={filtered ? t('activity.noMatch') : t('emptyStates.redemptionsText')}
                  action={
                    filtered ? (
                      <Button variant="outline" size="sm" onClick={clearFilters}>
                        {t('emptyStates.clearFilters')}
                      </Button>
                    ) : me.role !== 'viewer' ? (
                      <Button variant="outline" size="sm" asChild>
                        <WorkspaceLink to="/scan">{t('emptyStates.openTill')}</WorkspaceLink>
                      </Button>
                    ) : null
                  }
                />
                {data?.items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="ps-4 whitespace-nowrap tabular-nums">
                      {dayjs(r.createdAt).format('D MMM')} <span className="text-muted-foreground">{dayjs(r.createdAt).format('HH:mm')}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Thumb src={r.imageUrl} />
                        <span className="font-medium">{r.rewardName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-end font-semibold tabular-nums">{num(r.pointsCost)}</TableCell>
                    {branchOnly ? null : <TableCell>{r.branch.name}</TableCell>}
                    <TableCell>{r.staff.name}</TableCell>
                    <TableCell className="pe-4 font-mono text-xs text-muted-foreground">#{r.customerRef}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onChange={setPage} />
        </Card>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{t('redemptions.footnote', { shop: vendor.name })}</p>
    </>
  );
}

export function Thumb({ src }: { src: string | null }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground">
      {src ? <img src={src} alt="" className="size-full object-cover" /> : <Gift className="size-4" />}
    </span>
  );
}

/** Which rewards customers pick in the period, most given first. Click one to filter the list. */
function ByReward({ data, selected, onSelect }: { data: RedemptionPage | undefined; selected: string; onSelect: (id: string) => void }) {
  const max = Math.max(1, ...(data?.byReward.map((r) => r.count) ?? []));
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('redemptions.byReward')}</CardTitle>
        {selected !== ALL ? (
          <Button size="sm" variant="ghost" className="-my-1 text-muted-foreground" onClick={() => onSelect(ALL)}>
            <X /> {t('hours.clear')}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-1">
        {!data ? (
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)
        ) : data.byReward.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('redemptions.empty')}</p>
        ) : (
          data.byReward.map((r) => (
            <button
              key={r.rewardId}
              type="button"
              aria-pressed={selected === r.rewardId}
              onClick={() => onSelect(selected === r.rewardId ? ALL : r.rewardId)}
              className={cn(
                '-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 text-start outline-none transition-colors duration-100 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
                selected === r.rewardId && 'bg-accent hover:bg-accent',
              )}
            >
              <Thumb src={r.imageUrl} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{r.name}</span>
                  {r.status === 'archived' ? <Badge variant="secondary">{t('status.archived')}</Badge> : null}
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(r.count / max) * 100}%` }} />
                </div>
              </div>
              <div className="text-end">
                <div className="font-semibold tabular-nums">{num(r.count)}</div>
                <div className="text-xs text-muted-foreground tabular-nums">{t('common.pts', { n: r.points })}</div>
              </div>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}
