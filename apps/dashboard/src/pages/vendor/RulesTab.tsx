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
import { api, errorMessage, type Vendor } from '../../lib/api';
import { cn } from '@/lib/utils';

const amount = (v: string) => (v.endsWith('.00') ? v.slice(0, -3) : v);

/** Same formula as the API: floor(bill / spend) × points, 0 below the minimum, capped. */
function pointsFor(bill: number, r: { spendAmount: number; pointsPerSpend: number; minPurchase?: number; maxPointsPerPurchase?: number | null }) {
  if (!r.spendAmount || bill < (r.minPurchase ?? 0)) return 0;
  const p = Math.floor(Math.round(bill * 100) / Math.round(r.spendAmount * 100)) * r.pointsPerSpend;
  return r.maxPointsPerPurchase ? Math.min(p, r.maxPointsPerPurchase) : p;
}

/** The vendor's earning rule: the active one, publish a new version, history, stop earning. */
export function RulesTab({ vendor }: { vendor: Vendor }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState({ spendAmount: '10', pointsPerSpend: '1', minPurchase: '0', maxPointsPerPurchase: '' });
  const set = (k: keyof typeof draft) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const { data, isLoading, error } = useQuery({ queryKey: ['rules', vendor.id], queryFn: () => api.pointRules(vendor.id) });
  const active = data?.find((r) => r.isActive) ?? null;

  const done = (text: string) => {
    void qc.invalidateQueries({ queryKey: ['rules', vendor.id] });
    toast.success(text);
  };
  const publish = useMutation({
    mutationFn: (v: { spendAmount: number; pointsPerSpend: number; minPurchase?: number; maxPointsPerPurchase: number | null }) => api.publishRule(vendor.id, v),
    onSuccess: (r) => done(`Rule version ${r.version} is now active`),
    onError: (e) => void toast.error(errorMessage(e)),
  });
  const stop = useMutation({
    mutationFn: () => api.deactivateRule(vendor.id),
    onSuccess: () => done('Earning stopped'),
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
            <div className="text-sm text-muted-foreground">Current rule</div>
            {active ? (
              <>
                <div className="mt-1.5 mb-1 text-3xl font-bold tracking-tight text-accent-foreground">
                  Every {amount(active.spendAmount)} {vendor.currency} = {active.pointsPerSpend} point{active.pointsPerSpend === 1 ? '' : 's'}
                </div>
                <p className="text-sm text-muted-foreground">
                  Version {active.version} · since {dayjs(active.createdAt).format('D MMM YYYY')}
                  {Number(active.minPurchase) > 0 ? ` · bills from ${amount(active.minPurchase)} ${vendor.currency}` : ''}
                  {active.maxPointsPerPurchase ? ` · max ${active.maxPointsPerPurchase} per purchase` : ''}
                </p>
                <ConfirmAction
                  title="Stop earning points here?"
                  description="Staff will not be able to give points until a new rule is published. Points customers already have stay."
                  actionLabel="Stop earning"
                  onConfirm={() => stop.mutateAsync()}
                  trigger={
                    <Button variant="destructive" className="mt-5">
                      Stop earning
                    </Button>
                  }
                />
              </>
            ) : (
              <p className="mt-1.5 text-lg font-semibold">No active rule: customers can't earn points here yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{active ? 'Publish a new rule' : 'Set the points rule'}</CardTitle>
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
                <Field label={`Every (${vendor.currency})`} htmlFor="rule-spend">
                  <Input id="rule-spend" type="number" required min={0.01} max={99999999} step={0.01} value={draft.spendAmount} onChange={set('spendAmount')} />
                </Field>
                <Field label="Gives (points)" htmlFor="rule-points">
                  <Input id="rule-points" type="number" required min={1} max={10000} step={1} value={draft.pointsPerSpend} onChange={set('pointsPerSpend')} />
                </Field>
                <Field label={`Minimum bill (${vendor.currency})`} htmlFor="rule-min">
                  <Input id="rule-min" type="number" min={0} step={0.01} value={draft.minPurchase} onChange={set('minPurchase')} />
                </Field>
                <Field label="Max points per purchase" htmlFor="rule-max">
                  <Input id="rule-max" type="number" min={1} step={1} placeholder="No limit" value={draft.maxPointsPerPurchase} onChange={set('maxPointsPerPurchase')} />
                </Field>
              </div>
              {preview ? (
                <Alert>
                  <Calculator />
                  <AlertDescription className="flex flex-wrap gap-x-5 gap-y-1 text-foreground">
                    {preview.map((p) => (
                      <span key={p.bill} className="tabular-nums">
                        {p.bill} {vendor.currency} → <strong>{p.pts} pts</strong>
                      </span>
                    ))}
                  </AlertDescription>
                </Alert>
              ) : null}
              <div>
                <Button type="submit" disabled={publish.isPending}>
                  {publish.isPending ? <Loader2 className="animate-spin" /> : null}
                  {active ? 'Publish new version' : 'Publish rule'}
                </Button>
                <p className="mt-2.5 text-xs text-muted-foreground">Applies to new purchases only. Points already earned don't change.</p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="mb-3 font-semibold">History</h3>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Version</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Minimum bill</TableHead>
                <TableHead>Max per purchase</TableHead>
                <TableHead className="pr-4">Published</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableState loading={isLoading} empty={!data?.length} colSpan={5} emptyText="No rules yet" />
              {data?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-4">
                    v{r.version}{' '}
                    {r.isActive ? (
                      <Badge variant="brand" className="ml-1">
                        Active
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {amount(r.spendAmount)} {vendor.currency} = {r.pointsPerSpend} pt
                  </TableCell>
                  <TableCell>{Number(r.minPurchase) > 0 ? `${amount(r.minPurchase)} ${vendor.currency}` : '—'}</TableCell>
                  <TableCell>{r.maxPointsPerPurchase ?? '—'}</TableCell>
                  <TableCell className="pr-4">{dayjs(r.createdAt).format('D MMM YYYY, HH:mm')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
