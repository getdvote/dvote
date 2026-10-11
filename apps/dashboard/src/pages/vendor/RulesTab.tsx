import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Calculator, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmAction } from '../../components/ConfirmAction';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Field } from '../../components/Field';
import { TableState } from '../../components/TableState';
import { errorMessage} from '../../lib/api';
import type { VendorScope } from '../../lib/scope';
import { cn } from '@/lib/utils';
import { t } from '../../i18n';

const amount = (v: string) => (v.endsWith('.00') ? v.slice(0, -3) : v);

/** Same formula as the API: floor(bill / spend) × points, 0 below the minimum, capped. */
function pointsFor(bill: number, r: { spendAmount: number; pointsPerSpend: number; minPurchase?: number; maxPointsPerPurchase?: number | null }) {
  if (!r.spendAmount || bill < (r.minPurchase ?? 0)) return 0;
  const p = Math.floor(Math.round(bill * 100) / Math.round(r.spendAmount * 100)) * r.pointsPerSpend;
  return r.maxPointsPerPurchase ? Math.min(p, r.maxPointsPerPurchase) : p;
}

/** The vendor's earning rule: the active one, publish a new version, history, stop earning. */
export function RulesTab({ scope }: { scope: VendorScope }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState({ spendAmount: '10', pointsPerSpend: '1', minPurchase: '0', maxPointsPerPurchase: '' });
  const set = (k: keyof typeof draft) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const { data, isLoading, error } = useQuery({ queryKey: ['rules', scope.key], queryFn: () => scope.pointRules() });
  const active = data?.find((r) => r.isActive) ?? null;

  const done = (text: string) => {
    void qc.invalidateQueries({ queryKey: ['rules', scope.key] });
    toast.success(text);
  };
  const publish = useMutation({
    mutationFn: (v: { spendAmount: number; pointsPerSpend: number; minPurchase?: number; maxPointsPerPurchase: number | null }) => scope.publishRule(v),
    onSuccess: (r) => done(t('rules.publishedToast', { version: r.version })),
    onError: (e) => void toast.error(errorMessage(e)),
  });
  const stop = useMutation({
    mutationFn: () => scope.deactivateRule(),
    onSuccess: () => done(t('rules.stoppedToast')),
    onError: (e) => void toast.error(errorMessage(e)),
  });

  const spend = Number(draft.spendAmount);
  const per = Number(draft.pointsPerSpend);
  const preview = spend > 0 && per > 0
    ? [50, 95, 250].map((bill) => ({
        bill,
        pts: pointsFor(bill, {
          spendAmount: spend,
          pointsPerSpend: per,
          minPurchase: Number(draft.minPurchase) || 0,
          maxPointsPerPurchase: Number(draft.maxPointsPerPurchase) || null,
        }),
      }))
    : null;

  return (
    <div className="grid gap-6">
      <ErrorAlert error={error} />
      <div className="grid gap-5 lg:grid-cols-[11fr_13fr]">
        <Card className={cn('border-none ring-0', active ? 'bg-brand-soft' : 'bg-muted')}>
          <CardContent>
            <div className="text-sm text-muted-foreground">{t('rules.current')}</div>
            {active ? (
              <>
                <div className="mt-1.5 mb-1 text-3xl font-bold tracking-tight text-accent-foreground">
                  {t('rules.every', { amount: amount(active.spendAmount), currency: scope.currency, count: active.pointsPerSpend })}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('rules.versionSince', { version: active.version, date: dayjs(active.createdAt).format('D MMM YYYY') })}
                  {Number(active.minPurchase) > 0 ? ` · ${t('rules.billsFrom', { amount: amount(active.minPurchase), currency: scope.currency })}` : ''}
                  {active.maxPointsPerPurchase ? ` · ${t('rules.maxPer', { n: active.maxPointsPerPurchase })}` : ''}
                </p>
                {scope.can.editVendor ? (
                <ConfirmAction
                  title={t('rules.stopTitle')}
                  description={t('rules.stopText')}
                  actionLabel={t('rules.stop')}
                  onConfirm={() => stop.mutateAsync()}
                  trigger={
                    <Button variant="destructive" className="mt-5">
                      {t('rules.stop')}
                    </Button>
                  }
                />
                ) : null}
              </>
            ) : (
              <p className="mt-1.5 text-lg font-semibold">{t('rules.none')}</p>
            )}
          </CardContent>
        </Card>

        <Card className={scope.can.editVendor ? undefined : 'hidden'}>
          <CardHeader>
            <CardTitle>{active ? t('rules.publishNew') : t('rules.set')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                publish.mutate({
                  spendAmount: spend,
                  pointsPerSpend: per,
                  minPurchase: draft.minPurchase === '' ? undefined : Number(draft.minPurchase),
                  maxPointsPerPurchase: Number(draft.maxPointsPerPurchase) || null,
                });
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('rules.everyLabel', { currency: scope.currency })} htmlFor="rule-spend">
                  <Input id="rule-spend" type="number" required min={0.01} max={99999999} step={0.01} value={draft.spendAmount} onChange={set('spendAmount')} />
                </Field>
                <Field label={t('rules.gives')} htmlFor="rule-points">
                  <Input id="rule-points" type="number" required min={1} max={10000} step={1} value={draft.pointsPerSpend} onChange={set('pointsPerSpend')} />
                </Field>
                <Field label={t('rules.minLabel', { currency: scope.currency })} htmlFor="rule-min">
                  <Input id="rule-min" type="number" min={0} step={0.01} value={draft.minPurchase} onChange={set('minPurchase')} />
                </Field>
                <Field label={t('rules.maxLabel')} htmlFor="rule-max">
                  <Input id="rule-max" type="number" min={1} step={1} placeholder={t('rules.noLimit')} value={draft.maxPointsPerPurchase} onChange={set('maxPointsPerPurchase')} />
                </Field>
              </div>
              {preview ? (
                <Alert>
                  <Calculator />
                  <AlertDescription className="flex flex-wrap gap-x-5 gap-y-1 text-foreground">
                    {preview.map((p) => (
                      <span key={p.bill} className="tabular-nums">
                        {p.bill} {scope.currency} → <strong>{t('common.pts', { n: p.pts })}</strong>
                      </span>
                    ))}
                  </AlertDescription>
                </Alert>
              ) : null}
              <div>
                <Button type="submit" disabled={publish.isPending}>
                  {publish.isPending ? <Loader2 className="animate-spin" /> : null}
                  {active ? t('rules.publishVersion') : t('rules.publish')}
                </Button>
                <p className="mt-2.5 text-xs text-muted-foreground">{t('rules.appliesNew')}</p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="mb-3 font-semibold">{t('rules.history')}</h3>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">{t('rules.version')}</TableHead>
                <TableHead>{t('rules.rule')}</TableHead>
                <TableHead>{t('rules.minBill')}</TableHead>
                <TableHead>{t('rules.maxPerPurchase')}</TableHead>
                <TableHead className="pe-4">{t('rules.published')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableState loading={isLoading} empty={!data?.length} colSpan={5} emptyText={t('rules.empty')} />
              {data?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="ps-4">
                    v{r.version}{' '}
                    {r.isActive ? (
                      <Badge variant="brand" className="ms-1">
                        {t('status.active')}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {t('rules.short', { amount: amount(r.spendAmount), currency: scope.currency, n: r.pointsPerSpend })}
                  </TableCell>
                  <TableCell>{Number(r.minPurchase) > 0 ? `${amount(r.minPurchase)} ${scope.currency}` : '—'}</TableCell>
                  <TableCell>{r.maxPointsPerPurchase ?? '—'}</TableCell>
                  <TableCell className="pe-4">{dayjs(r.createdAt).format('D MMM YYYY, HH:mm')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
