import { useVendorApi } from '../../lib/vendor-workspace';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AddCircleIcon as Plus,
  CloseCircleIcon as XCircle,
  DownloadMinimalisticIcon as Download,
  LetterIcon as Send,
  LoaderIcon as Loader2,
  MenuDotsIcon as MoreHorizontal,
  PenIcon as Pencil,
  TrashBinTrashIcon as Trash2,
  UsersGroupRoundedIcon as UsersGroup,
} from '@solar-icons/react/linear';
import { useEffect, useState } from 'react';
import { WorkspaceLink as Link } from '../../lib/vendor-workspace';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmAction } from '../../components/ConfirmAction';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Field } from '../../components/Field';
import { num } from '../../components/PageHeader';
import {
  errorMessage,
  vendorApi,
  type CustomerSegment,
  type CustomSegment,
  type CustomSegmentInput,
  type MerchantCustomerList,
  type MerchantCustomerQuery,
  type SegmentRule,
  type SegmentRuleField,
} from '../../lib/api';
import { t } from '../../i18n';

/** Built-in segments in display order (same order as the API). */
export const SEGMENTS: {
  key: CustomerSegment;
  variant: 'brand' | 'success' | 'warning' | 'secondary' | 'destructive';
}[] = [
  { key: 'champions', variant: 'success' },
  { key: 'regulars', variant: 'brand' },
  { key: 'new', variant: 'brand' },
  { key: 'never_visited', variant: 'secondary' },
  { key: 'slipping', variant: 'warning' },
  { key: 'at_risk', variant: 'warning' },
  { key: 'lost', variant: 'destructive' },
];
export const segmentLabel = (key: CustomerSegment) => t(`customers.segments.${key}.label`);
export const segmentText = (key: CustomerSegment) => t(`customers.segments.${key}.description`);

export function SegmentBadge({ segment }: { segment: CustomerSegment }) {
  const s = SEGMENTS.find((item) => item.key === segment)!;
  return <Badge variant={s.variant}>{segmentLabel(s.key)}</Badge>;
}

export function CustomSegmentBadge({ name }: { name: string }) {
  return (
    <Badge variant="outline" className="max-w-40">
      <span className="truncate">{name}</span>
    </Badge>
  );
}

// ── Export ──────────────────────────────────────────────────────────

const csvCell = (v: string | number | null | undefined) => {
  let s = v === null || v === undefined ? '' : String(v);
  // Names and contact details come from customers: never let a spreadsheet run them as formulas.
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const cairoDay = (iso: string | null) => (iso ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date(iso)) : '');

/** Downloads every customer matching `q` as a CSV (with email and phone; merchant admins only). */
export async function exportCustomers(q: Omit<MerchantCustomerQuery, 'page' | 'pageSize'>, fileLabel: string, client = vendorApi) {
  const { items, truncated, asOf } = await client.customersExport(q);
  const head = [
    t('customers.reference'),
    t('customers.segmentNameLabel'),
    t('staff.email'),
    t('customers.phone'),
    t('customers.segment'),
    t('customers.customSegment'),
    t('insights.kpi.visits'),
    t('customers.spend'),
    t('insights.kpi.avgBill'),
    t('customers.balance'),
    t('customers.rewardsRedeemed'),
    t('customers.joined'),
    t('customers.firstPurchase'),
    t('customers.lastPurchase'),
  ];
  const rows = items.map((c) => [
    c.reference,
    c.name,
    c.email,
    c.phone,
    segmentLabel(c.segment),
    c.customSegment?.name,
    c.visits,
    c.spend,
    c.averageBill,
    c.pointsBalance,
    c.rewardsRedeemed,
    cairoDay(c.joinedAt),
    cairoDay(c.firstVisitAt),
    cairoDay(c.lastVisitAt),
  ]);
  const csv = '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `customers-${
    fileLabel
      .toLowerCase()
      .replace(/[^a-z0-9؀-ۿ]+/gi, '-')
      .replace(/^-|-$/g, '') || 'all'
  }-${asOf}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  if (truncated) toast.warning(t('customers.exportTruncated', { n: items.length }));
  else toast.success(t('customers.exported', { n: items.length }));
}

function ExportButton({ run }: { run: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="link"
      size="sm"
      className="h-auto px-0"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        run()
          .catch((e: unknown) => void toast.error(errorMessage(e)))
          .finally(() => setBusy(false));
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Download />} {t('customers.export')}
    </Button>
  );
}

// ── Segmentation tab ────────────────────────────────────────────────

function SegmentCard({
  title,
  description,
  count,
  total,
  loading,
  actions,
  menu,
}: {
  title: string;
  description: string | null;
  count: number;
  total: number;
  loading: boolean;
  actions: React.ReactNode;
  menu?: React.ReactNode;
}) {
  return (
    <Card className="gap-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        {menu}
      </div>
      <div className="flex items-baseline gap-2">
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <>
            <span className="text-2xl font-semibold tabular-nums">{num(count)}</span>
            <span className="text-sm text-muted-foreground tabular-nums">{total ? Math.round((count / total) * 100) : 0}%</span>
          </>
        )}
      </div>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">{actions}</div>
    </Card>
  );
}

/**
 * Built-in segments (automatic, every customer in exactly one) and the merchant's own segments
 * as cards: count, share, what it means, and See them / Send a message / Export.
 */
export function Segmentation({
  data,
  branchId,
  canEdit,
  onSee,
  onSeeCustom,
}: {
  data: MerchantCustomerList | undefined;
  branchId?: string;
  canEdit: boolean;
  onSee: (key: CustomerSegment) => void;
  onSeeCustom: (id: string) => void;
}) {
  const vendorApi = useVendorApi();
  const qc = useQueryClient();
  const total = data?.customersTotal ?? 0;
  const count = (key: CustomerSegment) => data?.segments.find((s) => s.key === key)?.count ?? 0;
  const [editing, setEditing] = useState<CustomSegment | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CustomSegment | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['merchant-customers'] });

  const seeActions = (see: () => void, message: string, exp: () => Promise<void>) => (
    <>
      <Button variant="link" size="sm" className="h-auto px-0" onClick={see}>
        {t('customers.seeThem')}
      </Button>
      <Button variant="link" size="sm" className="h-auto px-0" asChild>
        <Link to={message}>
          <Send /> {t('customers.sendMessage')}
        </Link>
      </Button>
      {canEdit ? <ExportButton run={exp} /> : null}
    </>
  );

  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <div>
          <h2 className="font-semibold">{t('customers.builtIn')}</h2>
          <p className="text-sm text-muted-foreground">{t('customers.builtInHint')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {SEGMENTS.map((s) => (
            <SegmentCard
              key={s.key}
              title={segmentLabel(s.key)}
              description={segmentText(s.key)}
              count={count(s.key)}
              total={total}
              loading={!data}
              actions={seeActions(
                () => onSee(s.key),
                `/broadcast?segment=${s.key}`,
                () => exportCustomers({ branchId, segment: s.key }, segmentLabel(s.key), vendorApi),
              )}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-2xl">
            <h2 className="font-semibold">{t('customers.custom')}</h2>
            <p className="text-sm text-muted-foreground">{t('customers.customHint')}</p>
          </div>
          {canEdit ? (
            <Button onClick={() => setEditing('new')}>
              <Plus /> {t('customers.newSegment')}
            </Button>
          ) : null}
        </div>
        {data && !data.customSegments.length ? (
          <Card className="items-center gap-2 border-dashed p-8 text-center">
            <UsersGroup className="size-8 text-muted-foreground" aria-hidden />
            <h3 className="font-semibold">{t('customers.noCustom')}</h3>
            <p className="max-w-md text-sm text-muted-foreground">{t('customers.noCustomText')}</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(data?.customSegments ?? []).map((s) => (
              <SegmentCard
                key={s.id}
                title={s.name}
                description={s.description}
                count={s.count}
                total={total}
                loading={false}
                actions={seeActions(
                  () => onSeeCustom(s.id),
                  `/broadcast?customSegment=${s.id}`,
                  () => exportCustomers({ branchId, customSegment: s.id }, s.name, vendorApi),
                )}
                menu={
                  canEdit ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={t('customers.editSegment')}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing(s)}>
                          <Pencil /> {t('customers.editSegment')}
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(s)}>
                          <Trash2 /> {t('customers.deleteSegment')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null
                }
              />
            ))}
          </div>
        )}
      </section>

      {editing ? (
        <SegmentDialog
          segment={editing === 'new' ? null : editing}
          branchId={branchId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      ) : null}
      <ConfirmAction
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('customers.deleteSegmentTitle', {
          name: deleting?.name ?? '',
        })}
        description={t('customers.deleteSegmentText')}
        actionLabel={t('customers.deleteSegment')}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await vendorApi.archiveSegment(deleting.id);
            toast.success(t('customers.segmentDeleted'));
            setDeleting(null);
            await refresh();
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </div>
  );
}

// ── Segment builder ─────────────────────────────────────────────────

const FIELDS: SegmentRuleField[] = [
  'visits',
  'visits_30d',
  'spend',
  'days_since_visit',
  'days_since_joined',
  'points',
  'rewards_redeemed',
  'segment',
];
const NUMBER_OPS = ['gte', 'lte', 'eq'] as const;
const SEGMENT_OPS = ['is', 'is_not'] as const;
const blankRule = (field: SegmentRuleField = 'visits'): SegmentRule =>
  field === 'segment' ? { field, op: 'is', value: 'champions' } : { field, op: 'gte', value: 1 };

/** A rule list the API accepts: numbers filled in. */
const ready = (rules: SegmentRule[]) => rules.every((r) => r.field === 'segment' || (r.value !== '' && Number(r.value) >= 0));

function SegmentDialog({
  segment,
  branchId,
  onClose,
  onSaved,
}: {
  segment: CustomSegment | null;
  branchId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const vendorApi = useVendorApi();
  const [name, setName] = useState(segment?.name ?? '');
  const [description, setDescription] = useState(segment?.description ?? '');
  const [match, setMatch] = useState<'all' | 'any'>(segment?.match ?? 'all');
  const [rules, setRules] = useState<SegmentRule[]>(segment?.rules ?? [blankRule()]);
  const [debounced, setDebounced] = useState({ match, rules });
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced({ match, rules }), 400);
    return () => window.clearTimeout(id);
  }, [match, rules]);

  const preview = useQuery({
    queryKey: ['segment-preview', branchId, debounced],
    queryFn: () =>
      vendorApi.segmentPreview({
        match: debounced.match,
        rules: debounced.rules.map((r) => (r.field === 'segment' ? r : { ...r, value: Number(r.value) })),
        branchId,
      }),
    enabled: debounced.rules.length > 0 && ready(debounced.rules),
  });

  const save = useMutation({
    mutationFn: (body: CustomSegmentInput) => (segment ? vendorApi.updateSegment(segment.id, body) : vendorApi.createSegment(body)),
    onSuccess: () => {
      toast.success(t(segment ? 'customers.segmentSaved' : 'customers.segmentCreated'));
      onSaved();
    },
  });
  const setRule = (i: number, r: SegmentRule) => setRules((list) => list.map((x, j) => (j === i ? r : x)));

  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{segment ? t('customers.editSegment') : t('customers.newSegment')}</DialogTitle>
          <DialogDescription>{t('customers.rulesHint')}</DialogDescription>
        </DialogHeader>
        <form
          id="segment-form"
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({
              name: name.trim(),
              description: description.trim() || null,
              match,
              rules: rules.map((r) => (r.field === 'segment' ? r : { ...r, value: Number(r.value) })),
            });
          }}
        >
          <Field label={t('customers.segmentNameLabel')} htmlFor="segment-name">
            <Input
              id="segment-name"
              required
              maxLength={60}
              pattern=".*\S.*"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('customers.segmentNamePlaceholder')}
            />
          </Field>
          <Field label={t('customers.segmentDescription')} htmlFor="segment-description">
            <Textarea
              id="segment-description"
              rows={2}
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('customers.segmentDescriptionPlaceholder')}
            />
          </Field>

          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium">{t('customers.rulesTitle')}</h3>
              {rules.length > 1 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {t('customers.match')}
                  <Select value={match} onValueChange={(v) => setMatch(v as 'all' | 'any')}>
                    <SelectTrigger size="sm" className="w-40" aria-label={t('customers.match')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('customers.matchAll')}</SelectItem>
                      <SelectItem value="any">{t('customers.matchAny')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
            {rules.length ? (
              rules.map((r, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto]"
                >
                  <Select value={r.field} onValueChange={(v) => setRule(i, blankRule(v as SegmentRuleField))}>
                    <SelectTrigger className="w-full" aria-label={t('customers.rulesTitle')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELDS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {t(`customers.fields.${f}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="sm:order-last"
                    aria-label={t('customers.removeRule')}
                    onClick={() => setRules((list) => list.filter((_, j) => j !== i))}
                  >
                    <XCircle />
                  </Button>
                  <Select value={r.op} onValueChange={(v) => setRule(i, { ...r, op: v as SegmentRule['op'] })}>
                    <SelectTrigger className="w-full" aria-label={t('customers.match')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(r.field === 'segment' ? SEGMENT_OPS : NUMBER_OPS).map((op) => (
                        <SelectItem key={op} value={op}>
                          {t(`customers.ops.${op}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {r.field === 'segment' ? (
                    <Select value={String(r.value)} onValueChange={(v) => setRule(i, { ...r, value: v })}>
                      <SelectTrigger className="w-full" aria-label={t('customers.fields.segment')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEGMENTS.map((s) => (
                          <SelectItem key={s.key} value={s.key}>
                            {segmentLabel(s.key)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={r.field === 'spend' ? '0.01' : 1}
                      required
                      dir="ltr"
                      value={r.value}
                      onChange={(e) => setRule(i, { ...r, value: e.target.value })}
                      aria-label={t(`customers.fields.${r.field}`)}
                    />
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">{t('customers.noRules')}</p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="outline" size="sm" disabled={rules.length >= 10} onClick={() => setRules((l) => [...l, blankRule()])}>
                <Plus /> {t('customers.addRule')}
              </Button>
              {rules.length ? (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-live="polite">
                  {preview.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  {preview.data
                    ? t('customers.matchNow', {
                        n: num(preview.data.count),
                        total: num(preview.data.customersTotal),
                      })
                    : null}
                </span>
              ) : null}
            </div>
          </div>
          <ErrorAlert error={save.error ?? preview.error} />
        </form>
        <DialogFooter>
          <Button variant="outline" disabled={save.isPending} onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="segment-form" disabled={save.isPending || !ready(rules)}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            {segment ? t('common.save') : t('customers.newSegment')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
