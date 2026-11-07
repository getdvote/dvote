import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircleIcon, ChatRoundDotsIcon, CalendarIcon, ClockCircleIcon, StarsIcon } from '@solar-icons/react/linear';
import dayjs from 'dayjs';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ConfirmAction } from '../../components/ConfirmAction';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Segmented } from '../../components/segmented';
import { useMyVendor } from '../../layouts/VendorLayout';
import { t, useI18n } from '../../i18n';
import { ApiError, errorMessage, type Billing, type BillingCycle, type PlanChange, type PlanName, type PlanRequest, type PriceQuote } from '../../lib/api';
import { ACTIVE_REWARD_LIMIT } from '../../lib/entitlements';
import { useVendorApi } from '../../lib/vendor-workspace';

const PLANS: PlanName[] = ['regular', 'loyal', 'chain'];
const RANK: Record<PlanName, number> = { regular: 1, loyal: 2, chain: 3 };
const WHATSAPP = '201207118966';

const egp = (n: number) => t('billing.money', { amount: n.toLocaleString('en-US') });
const day = (iso: string | null | undefined) => (iso ? dayjs(iso).format('D MMMM YYYY') : '');
const planName = (p: PlanName) => t(`billing.plans.${p}.name`);
const cycleName = (c: BillingCycle) => t(`billing.cycle.${c}`).toLowerCase();

/**
 * Settings → Billing (merchant admins): the current plan and its price, when it renews (or the trial
 * ends), and changing plan. During a trial a pick is just saved. On a paid plan (decided 2026-11-07,
 * until Paymob) every change is a request dvote approves after taking the money: an upgrade starts on
 * approval and costs the difference for the days left; a downgrade or monthly ↔ annual starts at the
 * end of the paid period, when the shop is forced down to it (the merchant picks what stays).
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
      {data.pendingRequest ? <PendingRequest billing={data} request={data.pendingRequest} /> : <LastDecision request={data.lastDecision} />}
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

/** What the request asks for, in one line. */
function requestSummary(r: Pick<PlanRequest, 'plan' | 'billingCycle' | 'branches'>) {
  return t('billing.requestSummary', { plan: planName(r.plan), cycle: cycleName(r.billingCycle), count: r.branches });
}

function PendingRequest({ billing: b, request: r }: { billing: Billing; request: PlanRequest }) {
  const api = useVendorApi();
  const qc = useQueryClient();
  const vendor = useMyVendor();
  const cancel = useMutation({
    mutationFn: () => api.cancelPlanRequest(),
    onSuccess: (res) => {
      qc.setQueryData(['billing'], res);
      toast.success(t('billing.requestCancelled'));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const message = encodeURIComponent(
    t('billing.requestPayMessage', { shop: vendor.name, change: requestSummary(r), amount: egp(r.amountDue) }),
  );
  return (
    <Alert className="border-brand-pressed/40 bg-brand-soft">
      <ClockCircleIcon className="size-4" />
      <AlertTitle>{t('billing.requestPendingTitle')}</AlertTitle>
      <AlertDescription className="grid gap-3">
        <p>
          {requestSummary(r)} ·{' '}
          {r.kind === 'upgrade'
            ? t('billing.requestUpgradeText', { amount: egp(r.amountDue) })
            : t('billing.requestLaterText', { date: day(b.paidUntil) })}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="brand" className="no-underline! hover:text-brand-foreground!">
            <a href={`https://wa.me/${WHATSAPP}?text=${message}`} target="_blank" rel="noreferrer">
              <ChatRoundDotsIcon />
              {t('billing.payWhatsApp')}
            </a>
          </Button>
          <Button size="sm" variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
            {t('billing.cancelRequest')}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

/** The latest answer from dvote, shown until the next request. */
function LastDecision({ request: r }: { request: PlanRequest | null }) {
  if (!r || r.status !== 'rejected') return null;
  return (
    <Alert>
      <AlertTitle>{t('billing.requestRejectedTitle', { change: requestSummary(r) })}</AlertTitle>
      <AlertDescription>{r.reviewNote || t('billing.requestRejectedText')}</AlertDescription>
    </Alert>
  );
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
            <PriceDetails quote={b.price} plan={b.plan} cycle={b.billingCycle} branches={b.branches} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('billing.noPlanText')}</p>
        )}

        <dl className="grid gap-3 sm:grid-cols-3">
          <DateItem
            label={b.state === 'trial' ? t('billing.trialEnds') : b.state === 'grace' ? t('billing.locksOn') : t('billing.renewsOn')}
            value={b.state === 'trial' ? day(b.trialEndsAt) : b.state === 'grace' ? day(b.graceEndsAt) : b.paidUntil ? day(b.paidUntil) : t('billing.managed')}
          />
          <DateItem
            label={t('billing.branches')}
            value={
              b.paidBranches !== null
                ? t('billing.branchesCovered', { count: b.paidBranches, open: b.openBranches })
                : t('billing.branchCount', { count: b.branches })
            }
          />
          {b.foundingUntil ? <DateItem label={t('billing.foundingUntil')} value={day(b.foundingUntil)} /> : null}
        </dl>

        {b.scheduled ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-3 text-sm">
            <p>
              <span className="font-medium">{t('billing.scheduledTitle')}</span>{' '}
              <span className="text-muted-foreground">
                {t('billing.scheduledText', {
                  plan: planName(b.scheduled.plan),
                  cycle: cycleName(b.scheduled.billingCycle),
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

/** What the monthly price is made of: the plan (with its first branch), each extra branch, the total. */
function PriceDetails({ quote, plan, cycle, branches }: { quote: PriceQuote; plan: PlanName; cycle: BillingCycle; branches: number }) {
  const extra = Math.max(0, branches - 1);
  const each = extra ? Math.round(quote.extraBranches / extra) : 0;
  const per = cycle === 'annual' ? t('billing.perMonthYearly') : t('billing.perMonth');
  return (
    <dl className="mt-3 grid max-w-md gap-1.5 rounded-lg border px-4 py-3 text-sm">
      <div className="flex items-start justify-between gap-4">
        <dt>
          {t('billing.detailsPlan', { plan: planName(plan) })}
          {quote.foundingApplied ? <span className="block text-xs text-muted-foreground">{t('billing.foundingApplied')}</span> : null}
        </dt>
        <dd className="shrink-0 tabular-nums">{egp(quote.base)}</dd>
      </div>
      {extra ? (
        <div className="flex items-start justify-between gap-4">
          <dt>{t('billing.detailsBranches', { count: extra, price: egp(each) })}</dt>
          <dd className="shrink-0 tabular-nums">{egp(quote.extraBranches)}</dd>
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-4 border-t pt-1.5 font-semibold">
        <dt>{t('billing.detailsTotal', { per })}</dt>
        <dd className="shrink-0 tabular-nums">{egp(quote.monthly)}</dd>
      </div>
      {cycle === 'annual' ? <p className="text-xs text-muted-foreground">{t('billing.billedYearly', { price: egp(quote.perPeriod) })}</p> : null}
      <p className="text-xs text-muted-foreground">{t('billing.vatNote')}</p>
    </dl>
  );
}

function PlanPicker({ billing: b }: { billing: Billing }) {
  const api = useVendorApi();
  const qc = useQueryClient();
  const [cycle, setCycle] = useState<BillingCycle>(b.billingCycle ?? 'monthly');
  const [branches, setBranches] = useState(b.branches);
  const [target, setTarget] = useState<PlanName | null>(null);
  const choose = useMutation({
    mutationFn: (plan: PlanName) => api.changePlan({ plan, billingCycle: cycle }),
    onSuccess: (r, plan) => {
      qc.setQueryData(['billing'], r);
      toast.success(t('billing.changedNow', { plan: planName(plan) }));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const requests = b.requestsRequired;
  const waiting = !!b.pendingRequest;
  const action = (p: PlanName) => {
    const same = p === b.plan && cycle === (b.billingCycle ?? 'monthly') && (!requests || branches === b.branches);
    if (same) return { label: t('billing.current'), disabled: true, kind: 'current' as const };
    if (waiting) return { label: t('billing.requestWaiting'), disabled: true, kind: 'current' as const };
    if (!requests || !b.plan) return { label: t('billing.choose'), disabled: false, kind: 'choose' as const };
    const up = RANK[p] > RANK[b.plan] || branches > b.branches;
    const down = RANK[p] < RANK[b.plan] || branches < b.branches;
    if (up && down) return { label: t('billing.requestSplit'), disabled: true, kind: 'current' as const };
    if (up) return { label: t('billing.requestUpgrade'), disabled: false, kind: 'up' as const };
    if (down) return { label: t('billing.requestDowngrade'), disabled: false, kind: 'down' as const };
    return { label: cycle === 'annual' ? t('billing.switchAnnual') : t('billing.switchMonthly'), disabled: false, kind: 'cycle' as const };
  };

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex sm:items-end sm:justify-between">
        <div className="grid gap-1.5">
          <CardTitle>{t('billing.plansTitle')}</CardTitle>
          <CardDescription>{requests ? t('billing.plansRequestText') : t('billing.plansText', { count: b.branches })}</CardDescription>
        </div>
        <div className="grid w-full gap-3 sm:w-auto sm:grid-flow-col sm:items-end">
          {requests ? (
            <div className="grid gap-1.5">
              <Label htmlFor="billing-branches" className="text-xs text-muted-foreground">
                {t('billing.branchesLabel')}
              </Label>
              <Input
                id="billing-branches"
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                className="w-full sm:w-28"
                value={branches}
                disabled={waiting}
                onChange={(e) => setBranches(Math.min(500, Math.max(1, Math.floor(Number(e.target.value) || 1))))}
              />
            </div>
          ) : null}
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
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((p) => {
          const priced = b.plans.find((x) => x.id === p)!;
          const q = priced[cycle];
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
                {b.foundingUntil && cycle === 'monthly' ? (
                  <p className="mt-1 text-xs font-medium text-brand-text">{t('billing.foundingAnnualHint', { price: egp(priced.annual.perPeriod) })}</p>
                ) : null}
                {b.branches > 1 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('billing.cardBreakdown', {
                      plan: planName(p),
                      base: egp(q.base),
                      count: b.branches - 1,
                      each: egp(Math.round(q.extraBranches / (b.branches - 1))),
                      total: egp(q.monthly),
                    })}
                  </p>
                ) : null}
                {requests && b.plan && p !== b.plan ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('billing.forYourBranches', { count: b.branches })}
                    {priced.upgradeDueNow !== null && cycle === (b.billingCycle ?? 'monthly')
                      ? ` · ${t('billing.upgradeNowCost', { amount: egp(priced.upgradeDueNow), date: day(b.paidUntil) })}`
                      : RANK[p] < RANK[b.plan]
                        ? ` · ${t('billing.downgradeFrom', { date: day(b.paidUntil) })}`
                        : ''}
                  </p>
                ) : null}
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
                ) : requests ? (
                  <Button className="w-full" variant={a.kind === 'up' ? 'default' : 'outline'} onClick={() => setTarget(p)}>
                    {a.label}
                  </Button>
                ) : (
                  <ConfirmAction
                    open={target === p}
                    onOpenChange={(o) => setTarget(o ? p : null)}
                    trigger={<Button className="w-full">{a.label}</Button>}
                    variant="default"
                    title={t('billing.confirmTitle', { plan: planName(p), cycle: cycleName(cycle) })}
                    description={t('billing.confirmChoose', {
                      plan: planName(p),
                      price: egp(cycle === 'annual' ? q.perPeriod : q.monthly),
                      per: cycle === 'annual' ? t('billing.perYear') : t('billing.perMonth'),
                    })}
                    actionLabel={a.label}
                    onConfirm={() => choose.mutateAsync(p)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
      {requests && target ? (
        <RequestDialog billing={b} change={{ plan: target, billingCycle: cycle, branches }} onClose={() => setTarget(null)} />
      ) : null}
    </Card>
  );
}

/**
 * Sending a plan request: what it is and costs (from the API), and for a downgrade below what is open
 * the branches and rewards that stay. Nothing changes until dvote approves it.
 */
function RequestDialog({ billing: b, change, onClose }: { billing: Billing; change: PlanChange; onClose: () => void }) {
  const api = useVendorApi();
  const qc = useQueryClient();
  const { language } = useI18n();
  const plan = change.plan;
  const down = RANK[plan] < RANK[b.plan ?? plan] || (change.branches ?? b.branches) < b.branches;
  const branchSlots = down && (change.branches ?? b.branches) < b.openBranches ? (change.branches ?? b.branches) : 0;
  const rewardLimit = ACTIVE_REWARD_LIMIT[plan];
  const rewardSlots = down && rewardLimit !== null && b.activeRewards > rewardLimit ? rewardLimit : 0;
  const [keepBranches, setKeepBranches] = useState<string[]>([]);
  const [keepRewards, setKeepRewards] = useState<string[]>([]);

  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.branches(), enabled: branchSlots > 0 });
  const rewards = useQuery({ queryKey: ['rewards'], queryFn: () => api.rewards(), enabled: rewardSlots > 0 });
  const ready = keepBranches.length === branchSlots && keepRewards.length === rewardSlots;
  const body: PlanChange = {
    ...change,
    ...(branchSlots ? { keepBranchIds: keepBranches } : {}),
    ...(rewardSlots ? { keepRewardIds: keepRewards } : {}),
  };
  const preview = useQuery({
    queryKey: ['billing-preview', body],
    queryFn: () => api.previewPlan(body),
    enabled: ready,
    retry: false,
  });
  const send = useMutation({
    mutationFn: () => api.changePlan(body),
    onSuccess: (r) => {
      qc.setQueryData(['billing'], r);
      toast.success(t('billing.requestSent'));
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const previewError = preview.error instanceof ApiError ? preview.error : null;

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('billing.requestTitle', { change: requestSummary({ plan, billingCycle: change.billingCycle, branches: change.branches ?? b.branches }) })}</DialogTitle>
          <DialogDescription>{t('billing.requestIntro')}</DialogDescription>
        </DialogHeader>

        {branchSlots ? (
          <KeepPicker
            title={t('billing.keepBranchesTitle', { count: branchSlots })}
            hint={t('billing.keepBranchesHint')}
            items={(branches.data ?? []).filter((x) => x.status === 'active').map((x) => ({ id: x.id, name: x.name }))}
            loading={branches.isLoading}
            max={branchSlots}
            value={keepBranches}
            onChange={setKeepBranches}
          />
        ) : null}
        {rewardSlots ? (
          <KeepPicker
            title={t('billing.keepRewardsTitle', { count: rewardSlots })}
            hint={t('billing.keepRewardsHint')}
            items={(rewards.data ?? [])
              .filter((x) => x.status === 'active')
              .map((x) => ({ id: x.id, name: (language === 'ar' && x.nameAr) || x.name }))}
            loading={rewards.isLoading}
            max={rewardSlots}
            value={keepRewards}
            onChange={setKeepRewards}
          />
        ) : null}
        {down ? <p className="text-sm text-muted-foreground">{t('billing.downgradeEffects')}</p> : null}

        <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm">
          {!ready ? (
            <p className="text-muted-foreground">{t('billing.keepFirst')}</p>
          ) : preview.isLoading ? (
            <Skeleton className="h-10" />
          ) : previewError ? (
            <p className="text-destructive">{errorMessage(previewError)}</p>
          ) : preview.data ? (
            <div className="grid gap-1">
              {preview.data.kind === 'upgrade' ? (
                <>
                  <p className="text-lg font-semibold tabular-nums">{t('billing.dueNow', { amount: egp(preview.data.amountDue) })}</p>
                  <p className="text-muted-foreground">{t('billing.prorateText', { date: day(b.paidUntil) })}</p>
                </>
              ) : (
                <p>{t('billing.startsLater', { date: day(preview.data.startsAt) })}</p>
              )}
              <p className="text-muted-foreground">
                {t('billing.thenPrice', {
                  price: egp(preview.data.periodPrice),
                  per: change.billingCycle === 'annual' ? t('billing.perYear') : t('billing.perMonth'),
                })}
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!ready || !preview.data || send.isPending} onClick={() => send.mutate()}>
            {t('billing.sendRequest')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KeepPicker({
  title,
  hint,
  items,
  loading,
  max,
  value,
  onChange,
}: {
  title: string;
  hint: string;
  items: { id: string; name: string }[];
  loading: boolean;
  max: number;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">
        {title} <span className="font-normal text-muted-foreground tabular-nums">({value.length}/{max})</span>
      </legend>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {loading ? (
        <Skeleton className="h-24" />
      ) : (
        <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto">
          {items.map((item) => {
            const checked = value.includes(item.id);
            return (
              <label
                key={item.id}
                className={cn('flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm', checked && 'border-primary bg-primary/5')}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={checked}
                  disabled={!checked && value.length >= max}
                  onChange={(e) => onChange(e.target.checked ? [...value, item.id] : value.filter((id) => id !== item.id))}
                />
                <span className="min-w-0 truncate">{item.name}</span>
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
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
