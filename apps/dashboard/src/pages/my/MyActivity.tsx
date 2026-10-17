import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useEffect, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Pager, SearchInput, SelectFilter, StatusFilter } from '../../components/ListControls';
import { num, PageHeader } from '../../components/PageHeader';
import { PeriodPicker, Total, usePeriod } from '../../components/PeriodFilter';
import { TableState } from '../../components/TableState';
import { useMe, useMyScope, useMyVendor } from '../../layouts/VendorLayout';
import { vendorApi, type ActivityItem, type PointEventType } from '../../lib/api';
import { cn } from '@/lib/utils';
import { localized, t } from '../../i18n';

const PAGE_SIZE = 25;
const ALL = 'all';

const TYPE: Record<PointEventType, 'success' | 'warning' | 'brand'> = {
  earn: 'success',
  redeem: 'warning',
  adjust: 'brand',
};
const typeLabel = (type: PointEventType) => t(`activity.types.${type}`);

/** Every collect, redemption and correction at my shops, newest first. Customers show as a card code. */
export function MyActivity() {
  const me = useMe();
  const scope = useMyScope();
  const vendor = useMyVendor();
  const branchOnly = me.branchId !== null; // branch roles; admins and viewers see every branch

  const [params] = useSearchParams();
  const period = usePeriod(params.get('period') === 'today' ? 'today' : '7d');
  const [type, setType] = useState<PointEventType | typeof ALL>(ALL);
  const [branchId, setBranchId] = useState(ALL);
  const [staffId, setStaffId] = useState(params.get('staff') ?? ALL);
  const [receiptInput, setReceiptInput] = useState('');
  const [receipt, setReceipt] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<ActivityItem | null>(null);

  // search after a short pause in typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setReceipt(receiptInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [receiptInput]);

  const query = {
    ...period.dates,
    type: type === ALL ? undefined : type,
    branchId: branchOnly || branchId === ALL ? undefined : branchId,
    staffId: staffId === ALL ? undefined : staffId,
    receipt: receipt || undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const { data, isLoading, error } = useQuery({
    queryKey: ['events', 'me', query],
    queryFn: () => vendorApi.events(query),
    placeholderData: (prev) => prev,
    refetchInterval: 60_000,
  });
  const { data: branches } = useQuery({ queryKey: ['branches', scope.key], queryFn: () => scope.branches(), enabled: !branchOnly });
  const { data: staff } = useQuery({ queryKey: ['staff', scope.key], queryFn: () => scope.staff() });

  // any filter change starts again at page 1
  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  const filtered = type !== ALL || branchId !== ALL || staffId !== ALL || !!receipt;
  const totals = data?.totals;

  return (
    <>
      <PageHeader
        title={t('nav.activity')}
        subtitle={t('activity.subtitle', { shop: branchOnly ? (me.branch?.name ?? t('availability.yourBranch')) : vendor.name })}
      />

      <PeriodPicker state={period} onChange={() => setPage(1)} />

      <Card className="mb-5 flex-row flex-wrap gap-0 divide-x py-0">
        <Total label={t('activity.sales')} value={totals ? `${num(Number(totals.sales))} ${vendor.currency}` : null} hint={t('activity.salesHint')} />
        <Total label={t('home.collects')} value={totals ? num(totals.collects) : null} />
        <Total label={t('home.pointsGiven')} value={totals ? num(totals.pointsEarned) : null} />
        <Total label={t('nav.redemptions')} value={totals ? num(totals.redemptions) : null} />
        <Total label={t('activity.pointsRedeemed')} value={totals ? num(totals.pointsRedeemed) : null} />
      </Card>

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap gap-3 p-4">
          <StatusFilter
            value={type}
            onChange={reset(setType)}
            options={[
              { value: ALL, label: t('common.all') },
              { value: 'earn', label: t('activity.filters.earn') },
              { value: 'redeem', label: t('activity.filters.redeem') },
              { value: 'adjust', label: t('activity.filters.adjust') },
            ]}
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
            label={t('nav.staff')}
            allLabel={t('activity.allStaff')}
            value={staffId}
            onChange={reset(setStaffId)}
            options={staff?.map((m) => ({ value: m.id, label: m.name }))}
          />
          <SearchInput value={receiptInput} onChange={setReceiptInput} placeholder={t('activity.searchReceipt')} />
        </div>
        <ErrorAlert error={error} className="mx-4 mb-4 w-auto" />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">{t('activity.time')}</TableHead>
                <TableHead>{t('activity.type')}</TableHead>
                <TableHead className="text-end">{t('common.points')}</TableHead>
                <TableHead className="text-end">{t('activity.bill')}</TableHead>
                <TableHead>{t('activity.receipt')}</TableHead>
                {branchOnly ? null : <TableHead>{t('common.branch')}</TableHead>}
                <TableHead>{t('nav.staff')}</TableHead>
                <TableHead className="pe-4">{t('activity.customer')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableState
                loading={isLoading}
                empty={!data?.items.length}
                colSpan={branchOnly ? 7 : 8}
                emptyText={filtered ? t('activity.noMatch') : t('activity.empty')}
              />
              {data?.items.map((e) => (
                <TableRow key={e.id} className="cursor-pointer" onClick={() => setOpen(e)}>
                  <TableCell className="ps-4 whitespace-nowrap tabular-nums">
                    {dayjs(e.createdAt).format('D MMM')} <span className="text-muted-foreground">{dayjs(e.createdAt).format('HH:mm')}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={TYPE[e.type]}>{typeLabel(e.type)}</Badge>
                    {e.reward ? <span className="ms-2 text-sm">{rewardName(e.reward)}</span> : null}
                  </TableCell>
                  <TableCell className={cn('text-end font-semibold tabular-nums', e.points > 0 ? 'text-success' : 'text-muted-foreground')}>
                    {signed(e.points)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{e.amount ? money(e.amount) : <Dash />}</TableCell>
                  <TableCell className="tabular-nums">{e.receiptRef ?? <Dash />}</TableCell>
                  {branchOnly ? null : <TableCell>{e.branch?.name ?? <Dash />}</TableCell>}
                  <TableCell>{e.staff?.name ?? (e.type === 'adjust' ? 'dvote' : <Dash />)}</TableCell>
                  <TableCell className="pe-4 font-mono text-xs text-muted-foreground">#{e.customerRef}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onChange={setPage} />
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        {t('activity.footnote', { shop: vendor.name })}
      </p>

      <ActivitySheet item={open} currency={vendor.currency} onClose={() => setOpen(null)} />
    </>
  );
}

const Dash = () => <span className="text-muted-foreground">—</span>;
const signed = (n: number) => (n > 0 ? `+${num(n)}` : `−${num(-n)}`);
/** The reward snapshot name, in Arabic when the reward has one. */
const rewardName = (r: { name: string; nameAr?: string | null }) => localized(r.name, r.nameAr);
const money = (s: string) => (s.endsWith('.00') ? num(Number(s)) : Number(s).toLocaleString('en-US', { minimumFractionDigits: 2 }));

/** One ledger row in full, with the list still behind it. */
export function ActivitySheet({ item, currency, onClose }: { item: ActivityItem | null; currency: string; onClose: () => void }) {
  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=left]:w-full data-[side=right]:sm:max-w-[440px] data-[side=left]:sm:max-w-[440px]">
        {item ? (
          <>
            <SheetHeader>
              <SheetTitle>
                {typeLabel(item.type)} · {t('activity.pointsN', { n: signed(item.points) })}
              </SheetTitle>
              <SheetDescription>{dayjs(item.createdAt).format('dddd D MMMM YYYY, HH:mm')}</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              <Separator className="mb-2" />
              <dl className="divide-y text-sm">
                {item.reward ? <Row label={t('rewards.reward')}>{rewardName(item.reward)}</Row> : null}
                {item.amount ? (
                  <Row label={t('activity.bill')}>
                    {money(item.amount)} {currency}
                  </Row>
                ) : null}
                {item.type === 'earn' ? <Row label={t('activity.receipt')}>{item.receiptRef ?? t('activity.notEntered')}</Row> : null}
                {item.reason ? <Row label={t('activity.reason')}>{item.reason}</Row> : null}
                <Row label={t('common.branch')}>{item.branch?.name ?? '—'}</Row>
                <Row label={item.type === 'adjust' ? t('activity.by') : t('activity.scannedBy')}>{item.staff?.name ?? (item.type === 'adjust' ? t('activity.support') : '—')}</Row>
                <Row label={t('activity.customer')}>
                  <span className="font-mono">#{item.customerRef}</span>
                </Row>
              </dl>
              {item.type === 'adjust' ? (
                <p className="mt-4 text-xs text-muted-foreground">{t('activity.correctionNote')}</p>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-6 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end font-medium">{children}</dd>
    </div>
  );
}
