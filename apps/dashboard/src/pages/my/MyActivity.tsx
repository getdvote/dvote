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

const PAGE_SIZE = 25;
const ALL = 'all';

const TYPE: Record<PointEventType, { label: string; variant: 'success' | 'warning' | 'brand' }> = {
  earn: { label: 'Collect', variant: 'success' },
  redeem: { label: 'Redemption', variant: 'warning' },
  adjust: { label: 'Correction', variant: 'brand' },
};

/** Every collect, redemption and correction at my shops, newest first. Customers show as a card code. */
export function MyActivity() {
  const me = useMe();
  const scope = useMyScope();
  const vendor = useMyVendor();
  const branchOnly = me.role !== 'vendor_admin';

  const period = usePeriod();
  const [type, setType] = useState<PointEventType | typeof ALL>(ALL);
  const [branchId, setBranchId] = useState(ALL);
  const [staffId, setStaffId] = useState(ALL);
  const [receiptInput, setReceiptInput] = useState('');
  const [receipt, setReceipt] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<ActivityItem | null>(null);

  // search after a short pause in typing
  useEffect(() => {
    const t = setTimeout(() => {
      setReceipt(receiptInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
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
  const t = data?.totals;

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle={`Every collect and redemption at ${branchOnly ? (me.branch?.name ?? 'your branch') : vendor.name}, newest first.`}
      />

      <PeriodPicker state={period} onChange={() => setPage(1)} />

      <Card className="mb-5 flex-row flex-wrap gap-0 divide-x py-0">
        <Total label="Sales with dvote" value={t ? `${num(Number(t.sales))} ${vendor.currency}` : null} hint="Sum of bills on collects" />
        <Total label="Collects" value={t ? num(t.collects) : null} />
        <Total label="Points given" value={t ? num(t.pointsEarned) : null} />
        <Total label="Redemptions" value={t ? num(t.redemptions) : null} />
        <Total label="Points redeemed" value={t ? num(t.pointsRedeemed) : null} />
      </Card>

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap gap-3 p-4">
          <StatusFilter
            value={type}
            onChange={reset(setType)}
            options={[
              { value: ALL, label: 'All' },
              { value: 'earn', label: 'Collects' },
              { value: 'redeem', label: 'Redemptions' },
              { value: 'adjust', label: 'Corrections' },
            ]}
          />
          {branchOnly ? null : (
            <SelectFilter
              label="Branch"
              allLabel="All branches"
              value={branchId}
              onChange={reset(setBranchId)}
              options={branches?.map((b) => ({ value: b.id, label: b.name }))}
            />
          )}
          <SelectFilter
            label="Staff"
            allLabel="All staff"
            value={staffId}
            onChange={reset(setStaffId)}
            options={staff?.map((m) => ({ value: m.id, label: m.name }))}
          />
          <SearchInput value={receiptInput} onChange={setReceiptInput} placeholder="Search receipt number" />
        </div>
        <ErrorAlert error={error} className="mx-4 mb-4 w-auto" />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead className="text-right">Bill</TableHead>
                <TableHead>Receipt</TableHead>
                {branchOnly ? null : <TableHead>Branch</TableHead>}
                <TableHead>Staff</TableHead>
                <TableHead className="pr-4">Customer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableState
                loading={isLoading}
                empty={!data?.items.length}
                colSpan={branchOnly ? 7 : 8}
                emptyText={filtered ? 'Nothing matches these filters. Try another period or clear a filter.' : 'No activity in this period yet. Collects show here as soon as staff scan a customer.'}
              />
              {data?.items.map((e) => (
                <TableRow key={e.id} className="cursor-pointer" onClick={() => setOpen(e)}>
                  <TableCell className="pl-4 whitespace-nowrap tabular-nums">
                    {dayjs(e.createdAt).format('D MMM')} <span className="text-muted-foreground">{dayjs(e.createdAt).format('HH:mm')}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={TYPE[e.type].variant}>{TYPE[e.type].label}</Badge>
                    {e.reward ? <span className="ml-2 text-sm">{e.reward.name}</span> : null}
                  </TableCell>
                  <TableCell className={cn('text-right font-semibold tabular-nums', e.points > 0 ? 'text-success' : 'text-muted-foreground')}>
                    {signed(e.points)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{e.amount ? money(e.amount) : <Dash />}</TableCell>
                  <TableCell className="tabular-nums">{e.receiptRef ?? <Dash />}</TableCell>
                  {branchOnly ? null : <TableCell>{e.branch?.name ?? <Dash />}</TableCell>}
                  <TableCell>{e.staff?.name ?? (e.type === 'adjust' ? 'dvote' : <Dash />)}</TableCell>
                  <TableCell className="pr-4 font-mono text-xs text-muted-foreground">#{e.customerRef}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onChange={setPage} />
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        Each card code identifies a customer at {vendor.name}. View customer names and loyalty profiles in Customers; email and phone stay private.
      </p>

      <ActivitySheet item={open} currency={vendor.currency} onClose={() => setOpen(null)} />
    </>
  );
}

const Dash = () => <span className="text-muted-foreground">—</span>;
const signed = (n: number) => (n > 0 ? `+${num(n)}` : `−${num(-n)}`);
const money = (s: string) => (s.endsWith('.00') ? num(Number(s)) : Number(s).toLocaleString('en-US', { minimumFractionDigits: 2 }));

/** One ledger row in full, with the list still behind it. */
function ActivitySheet({ item, currency, onClose }: { item: ActivityItem | null; currency: string; onClose: () => void }) {
  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-[440px]">
        {item ? (
          <>
            <SheetHeader>
              <SheetTitle>
                {TYPE[item.type].label} · {signed(item.points)} points
              </SheetTitle>
              <SheetDescription>{dayjs(item.createdAt).format('dddd D MMMM YYYY, HH:mm')}</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              <Separator className="mb-2" />
              <dl className="divide-y text-sm">
                {item.reward ? <Row label="Reward">{item.reward.name}</Row> : null}
                {item.amount ? (
                  <Row label="Bill">
                    {money(item.amount)} {currency}
                  </Row>
                ) : null}
                {item.type === 'earn' ? <Row label="Receipt">{item.receiptRef ?? 'Not entered'}</Row> : null}
                {item.reason ? <Row label="Reason">{item.reason}</Row> : null}
                <Row label="Branch">{item.branch?.name ?? '—'}</Row>
                <Row label={item.type === 'adjust' ? 'By' : 'Scanned by'}>{item.staff?.name ?? (item.type === 'adjust' ? 'dvote support' : '—')}</Row>
                <Row label="Customer">
                  <span className="font-mono">#{item.customerRef}</span>
                </Row>
              </dl>
              {item.type === 'adjust' ? (
                <p className="mt-4 text-xs text-muted-foreground">Corrections are made by dvote support. They add or remove points without changing the original record.</p>
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
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
