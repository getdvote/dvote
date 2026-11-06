import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircleIcon, ChatRoundDotsIcon, CalendarIcon, StarsIcon } from '@solar-icons/react/linear';
import dayjs from 'dayjs';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ConfirmAction } from '../../components/ConfirmAction';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Segmented } from '../../components/segmented';
import { useMyVendor } from '../../layouts/VendorLayout';
import { t } from '../../i18n';
import { errorMessage, type Billing, type BillingCycle, type PlanName, type PriceQuote } from '../../lib/api';
import { useVendorApi } from '../../lib/vendor-workspace';

const PLANS: PlanName[] = ['regular', 'loyal', 'chain'];
const RANK: Record<PlanName, number> = { regular: 1, loyal: 2, chain: 3 };
const WHATSAPP = '201207118966';

const egp = (n: number) => t('billing.money', { amount: n.toLocaleString('en-US') });
const day = (iso: string | null | undefined) => (iso ? dayjs(iso).format('D MMMM YYYY') : '');
const planName = (p: PlanName) => t(`billing.plans.${p}.name`);

/**
 * Settings → Billing (merchant admins): the current plan and what it costs for the shop's open
 * branches, when it renews (or the trial ends), and changing plan. Upgrades apply at once;
 * downgrades and monthly ↔ annual wait for the end of the paid period. Until online payment
 * arrives, dvote collects the money and renews the period (WhatsApp).
 */
export function BillingSettings() {
  const api = useVendorApi();
  const { data, error, isLoading } = useQuery({ queryKey: ['billing'], queryFn: () => api.billing() });
  if (error) return <ErrorAlert error={error} />;
  if (isLoading || !data) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }
  return (
    <div className="grid gap-6">
      <StatusNotice billing={data} />
      <CurrentPlan billing={data} />
      <PlanPicker billing={data} />
      <Payments />
    </div>
  );
}

function StatusNotice({ billing: b }: { billing: Billing }) {
  if (b.state === 'grace') {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('billing.graceTitle')}</AlertTitle>
        <AlertDescription>{t('billing.graceText', { paid: day(b.paidUntil), locks: day(b.graceEndsAt) })}</AlertDescription>
      </Alert>
    );
  }
  if (b.state === 'trial' && b.trialEndsAt) {
    return (
      <Alert className="border-brand-pressed/40 bg-brand-soft">
        <AlertTitle>{t('billing.trialTitle', { date: day(b.trialEndsAt) })}</AlertTitle>
        <AlertDescription>{b.plan ? t('billing.trialPicked', { plan: planName(b.plan) }) : t('billing.trialText')}</AlertDescription>
      </Alert>
    );
  }
  return null;
}

function CurrentPlan({ billing: b }: { billing: Billing }) {
  const api = useVendorApi();
  const qc = useQueryClient();
  const cancel = useMutation({
    mutationFn: () => api.cancelScheduledPlan(),
    onSuccess: (r) => {
      qc.setQueryData(['billing'], r);
      toast.success(t('billing.cancelled'));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const status =
    b.state === 'trial'
      ? { label: t('billing.state.trial'), variant: 'secondary' as const }
      : b.state === 'grace'
        ? { label: t('billing.state.grace'), variant: 'destructive' as const }
        : { label: t('billing.state.active'), variant: 'default' as const };

  return (
    <Card>
      <CardHeader>
        <CardDescription>{t('billing.currentPlan')}</CardDescription>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-2xl">{b.plan ? planName(b.plan) : t('billing.noPlan')}</CardTitle>
          <Badge variant={status.variant}>{status.label}</Badge>
          {b.plan && b.billingCycle ? <Badge variant="outline">{t(`billing.cycle.${b.billingCycle}`)}</Badge> : null}
          {b.foundingUntil ? (
            <Badge variant="outline" className="gap-1">
              <StarsIcon className="size-3.5" />
              {t('billing.founding')}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        {b.price && b.plan && b.billingCycle ? (
          <div className="grid gap-1">
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              {egp(b.price.monthly)} <span className="text-base font-normal text-muted-foreground">{t('billing.perMonth')}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              <PriceBreakdown quote={b.price} plan={b.plan} cycle={b.billingCycle} branches={b.branches} />
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('billing.noPlanText')}</p>
        )}

        <dl className="grid gap-3 sm:grid-cols-3">
          <DateItem
            label={b.state === 'trial' ? t('billing.trialEnds') : b.state === 'grace' ? t('billing.locksOn') : t('billing.renewsOn')}
            value={b.state === 'trial' ? day(b.trialEndsAt) : b.state === 'grace' ? day(b.graceEndsAt) : b.paidUntil ? day(b.paidUntil) : t('billing.managed')}
          />
          <DateItem label={t('billing.branches')} value={t('billing.branchCount', { count: b.branches })} />
          {b.foundingUntil ? <DateItem label={t('billing.foundingUntil')} value={day(b.foundingUntil)} /> : null}
        </dl>

        {b.scheduled ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-3 text-sm">
            <p>
              <span className="font-medium">{t('billing.scheduledTitle')}</span>{' '}
              <span className="text-muted-foreground">
                {t('billing.scheduledText', {
                  plan: planName(b.scheduled.plan),
                  cycle: t(`billing.cycle.${b.scheduled.billingCycle}`).toLowerCase(),
                  date: day(b.scheduled.startsAt),
                  price: egp(b.scheduled.price.monthly),
                })}
              </span>
            </p>
            <Button size="sm" variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
              {t('billing.cancelChange')}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DateItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-muted/50 px-3 py-2.5">
      <CalendarIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate text-sm font-medium">{value}</dd>
      </div>
    </div>
  );
}

function PriceBreakdown({ quote, plan, cycle, branches }: { quote: PriceQuote; plan: PlanName; cycle: BillingCycle; branches: number }) {
  const parts = [t('billing.breakdownPlan', { plan: planName(plan), price: egp(quote.base) })];
  if (branches > 1) parts.push(t('billing.breakdownBranches', { count: branches - 1, price: egp(quote.extraBranches) }));
  if (cycle === 'annual') parts.push(t('billing.billedYearly', { price: egp(quote.perPeriod) }));
  if (quote.foundingApplied) parts.push(t('billing.foundingApplied'));
  return <>{parts.join(' · ')}</>;
}

function PlanPicker({ billing: b }: { billing: Billing }) {
  const api = useVendorApi();
  const qc = useQueryClient();
  const vendor = useMyVendor();
  const [cycle, setCycle] = useState<BillingCycle>(b.billingCycle ?? 'monthly');
  const [target, setTarget] = useState<PlanName | null>(null);
  const change = useMutation({
    mutationFn: (plan: PlanName) => api.changePlan(plan, cycle),
    onSuccess: (r, plan) => {
      qc.setQueryData(['billing'], r);
      toast.success(r.plan === plan ? t('billing.changedNow', { plan: planName(plan) }) : t('billing.changedLater', { plan: planName(plan), date: day(r.paidUntil) }));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const paid = b.state === 'active' || b.state === 'grace';
  const action = (p: PlanName) => {
    const same = p === b.plan && cycle === (b.billingCycle ?? 'monthly');
    const scheduledHere = b.scheduled?.plan === p && b.scheduled.billingCycle === cycle;
    if (same) return { label: t('billing.current'), disabled: true, kind: 'current' as const };
    if (scheduledHere) return { label: t('billing.scheduledBadge'), disabled: true, kind: 'current' as const };
    if (!b.plan || b.state === 'trial') return { label: t('billing.choose'), disabled: false, kind: 'choose' as const };
    if (p === b.plan) return { label: cycle === 'annual' ? t('billing.switchAnnual') : t('billing.switchMonthly'), disabled: false, kind: 'cycle' as const };
    return RANK[p] > RANK[b.plan]
      ? { label: t('billing.upgrade'), disabled: false, kind: 'up' as const }
      : { label: t('billing.downgrade'), disabled: false, kind: 'down' as const };
  };

  const confirmText = (p: PlanName) => {
    const a = action(p);
    const q = b.plans.find((x) => x.id === p)![cycle];
    const price = egp(cycle === 'annual' ? q.perPeriod : q.monthly);
    const per = cycle === 'annual' ? t('billing.perYear') : t('billing.perMonth');
    if (a.kind === 'choose' || !paid) return t('billing.confirmChoose', { plan: planName(p), price, per });
    if (a.kind === 'up') {
      return cycle === (b.billingCycle ?? 'monthly')
        ? t('billing.confirmUpgrade', { plan: planName(p), price, per, date: day(b.paidUntil) })
        : t('billing.confirmUpgradeCycle', { plan: planName(p), price, per, date: day(b.paidUntil) });
    }
    return t('billing.confirmLater', { current: planName(b.plan!), plan: planName(p), price, per, date: day(b.paidUntil) });
  };

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex sm:items-end sm:justify-between">
        <div className="grid gap-1.5">
          <CardTitle>{t('billing.plansTitle')}</CardTitle>
          <CardDescription>{t('billing.plansText', { count: b.branches })}</CardDescription>
        </div>
        <div className="w-full sm:w-72">
          <Segmented
            label={t('billing.cycleLabel')}
            value={cycle}
            onChange={setCycle}
            options={[
              { value: 'monthly', label: t('billing.cycle.monthly') },
              { value: 'annual', label: t('billing.annualSave') },
            ]}
          />
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((p) => {
          const q = b.plans.find((x) => x.id === p)![cycle];
          const a = action(p);
          const isCurrent = p === b.plan;
          return (
            <div
              key={p}
              className={cn(
                'flex flex-col gap-4 rounded-xl border p-5',
                isCurrent ? 'border-foreground/70 ring-1 ring-foreground/70' : p === 'loyal' ? 'border-brand-pressed' : '',
              )}
            >
              <div className="grid gap-1">
                <div className="flex min-h-6 items-center justify-between gap-2">
                  <h3 className="font-semibold">{planName(p)}</h3>
                  {isCurrent ? (
                    <Badge variant="secondary">{t('billing.yourPlan')}</Badge>
                  ) : p === 'loyal' ? (
                    <Badge className="bg-brand text-brand-foreground">{t('billing.recommended')}</Badge>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground lg:min-h-10">{t(`billing.plans.${p}.for`)}</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight tabular-nums">
                  {egp(q.monthly)} <span className="text-sm font-normal text-muted-foreground">{t('billing.perMonth')}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {cycle === 'annual' ? t('billing.billedYearly', { price: egp(q.perPeriod) }) : t('billing.billedMonthly')}
                  {q.foundingApplied ? ` · ${t('billing.foundingApplied')}` : ''}
                </p>
              </div>
              <ul className="grid gap-2 text-sm">
                {(['f1', 'f2', 'f3', 'f4'] as const).map((f) => (
                  <li key={f} className="flex gap-2">
                    <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-success" />
                    <span>{t(`billing.plans.${p}.${f}`)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                {a.disabled ? (
                  <Button className="w-full" variant="outline" disabled>
                    {a.label}
                  </Button>
                ) : (
                  <ConfirmAction
                    open={target === p}
                    onOpenChange={(o) => setTarget(o ? p : null)}
                    trigger={
                      <Button className="w-full" variant={a.kind === 'up' || a.kind === 'choose' ? 'default' : 'outline'}>
                        {a.label}
                      </Button>
                    }
                    variant="default"
                    title={t('billing.confirmTitle', { plan: planName(p), cycle: t(`billing.cycle.${cycle}`).toLowerCase() })}
                    description={
                      <>
                        {confirmText(p)}
                        {paid ? <span className="mt-2 block">{t('billing.confirmPayment', { shop: vendor.name })}</span> : null}
                      </>
                    }
                    actionLabel={a.label}
                    onConfirm={() => change.mutateAsync(p)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function Payments() {
  const vendor = useMyVendor();
  const message = encodeURIComponent(t('billing.payMessage', { shop: vendor.name }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('billing.paymentsTitle')}</CardTitle>
        <CardDescription>{t('billing.paymentsText')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline">
          <a href={`https://wa.me/${WHATSAPP}?text=${message}`} target="_blank" rel="noreferrer">
            <ChatRoundDotsIcon />
            {t('billing.payWhatsApp')}
          </a>
        </Button>
        <p className="text-sm text-muted-foreground">{t('billing.vatNote')}</p>
      </CardContent>
    </Card>
  );
}
