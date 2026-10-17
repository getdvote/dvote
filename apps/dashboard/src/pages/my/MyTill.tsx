import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircleIcon as CheckCircle2, GiftIcon as Gift, KeyboardIcon as Keyboard, LoaderIcon as Loader2, ScannerIcon as ScanLine } from '@solar-icons/react/linear';
import { useRef, useState, type ComponentType, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Field } from '../../components/Field';
import { num } from '../../components/PageHeader';
import { QrScanner } from '../../components/QrScanner';
import { errorText, t } from '../../i18n';
import { useMe, useMyScope } from '../../layouts/VendorLayout';
import { ApiError, errorMessage, vendorApi, type RedeemPreview, type StaffMe } from '../../lib/api';
import { branchState, OPENING_HOURS, stateLabel, type BranchState } from '../../lib/hours';

const QR_PREFIX = 'dvote:q1:';
const BRANCH_KEY = 'dvote-till-branch';

type Rule = NonNullable<StaffMe['activeRule']>;

/** One till visit, from the scan to the result. */
type Step =
  | { kind: 'scan'; rewardOnly: boolean; manual: boolean }
  | { kind: 'amount'; code: string }
  | { kind: 'redeem'; code: string; preview: RedeemPreview }
  | { kind: 'collected'; points: number; amount: string; currency: string }
  | { kind: 'given'; reward: string; points: number; balance: number };

/** "380", "95.5", "95,50" → minor units (piastres), or null. Same as the staff app. */
function parseAmount(text: string): number | null {
  const m = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!m) return null;
  const minor = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return minor > 0 ? minor : null;
}

/** Preview only, the server's formula: floor(amount / spend) × points, capped; 0 below the minimum. */
function estimatePoints(minor: number, rule: Rule): number {
  const toMinor = (v: string) => Math.round(Number(v) * 100);
  if (minor < toMinor(rule.minPurchase)) return 0;
  const points = Math.floor(minor / toMinor(rule.spendAmount)) * rule.pointsPerSpend;
  return rule.maxPointsPerPurchase === null ? points : Math.min(points, rule.maxPointsPerPurchase);
}

const money = (v: string) => v.replace(/\.00$/, '');

/**
 * The till: the staff app's scan → bill amount / confirm reward → done, in the dashboard.
 * Every account can use it (plain staff get only this page). The camera reads the QR, or a
 * hand scanner / the keyboard types it. Vendor and branch come from the signed-in account;
 * a merchant admin picks the branch they are working at (remembered in this browser).
 */
export function MyTill() {
  const me = useMe();
  const scope = useMyScope();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step | null>(null);

  const [picked, setPicked] = useState<string | null>(() => {
    try {
      return localStorage.getItem(BRANCH_KEY);
    } catch {
      return null;
    }
  });
  const pick = (id: string) => {
    setPicked(id);
    try {
      localStorage.setItem(BRANCH_KEY, id);
    } catch {
      // private mode: just not remembered
    }
  };
  const branchId = me.branch?.id ?? (me.branches.length === 1 ? me.branches[0].id : me.branches.some((b) => b.id === picked) ? picked : null);
  const mustPick = !me.branch && me.branches.length > 1;
  const ready = !!branchId;

  const { data: today } = useQuery({ queryKey: ['scans', 'today'], queryFn: vendorApi.scansToday, refetchInterval: 60_000 });
  // Open / closed for the branch (the branches list is for managers and admins only).
  const { data: branches } = useQuery({ queryKey: ['branches', scope.key], queryFn: () => scope.branches(), enabled: OPENING_HOURS && me.role !== 'staff', refetchInterval: 60_000 });
  const branch = branches?.find((b) => b.id === branchId);
  const state = branch ? branchState(branch) : null;

  const done = () => {
    void qc.invalidateQueries({ queryKey: ['scans', 'today'] });
    void qc.invalidateQueries({ queryKey: ['vendor'] });
  };

  return (
    <div className="mx-auto w-full max-w-3xl pt-2">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">{me.vendor.name}</div>
          <h1 className="text-xl font-semibold tracking-tight">{t('till.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          {mustPick ? (
            <Select value={branchId ?? undefined} onValueChange={pick}>
              <SelectTrigger className="w-52" aria-label={t('till.branch')}>
                <SelectValue placeholder={t('till.pickBranch')} />
              </SelectTrigger>
              <SelectContent>
                {me.branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : me.branch ? (
            <span className="text-sm text-muted-foreground">{me.branch.name}</span>
          ) : null}
          {state ? <StateBadge state={state} /> : null}
        </div>
      </div>

      {me.branches.length === 0 ? <ErrorAlert className="mb-4" error={t('till.noBranch')} /> : null}
      {mustPick && !branchId ? <p className="mb-4 text-sm text-muted-foreground">{t('till.pickBranchFirst')}</p> : null}

      <button
        type="button"
        disabled={!ready}
        onClick={() => setStep({ kind: 'scan', rewardOnly: false, manual: false })}
        className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl bg-primary px-6 py-14 text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ScanLine className="size-9" strokeWidth={1.75} aria-hidden />
        <span className="text-2xl font-medium">{t('till.scan')}</span>
        <span className="text-sm text-primary-foreground/80">{t('till.scanHint')}</span>
      </button>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Tile icon={Gift} title={t('till.redeem')} hint={t('till.redeemHint')} disabled={!ready} onClick={() => setStep({ kind: 'scan', rewardOnly: true, manual: false })} />
        <Tile icon={Keyboard} title={t('till.type')} hint={t('till.typeHint')} disabled={!ready} onClick={() => setStep({ kind: 'scan', rewardOnly: false, manual: true })} />
      </div>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        {me.activeRule
          ? t('till.rule', { spend: money(me.activeRule.spendAmount), currency: me.vendor.currency, points: me.activeRule.pointsPerSpend })
          : t('till.noRule')}
      </p>

      <Link to={`/activity?period=today&staff=${me.id}`} className="mt-10 block rounded-xl border bg-card px-5 py-4 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="font-medium">{t('till.today', { collects: num(today?.collects ?? 0), redemptions: num(today?.redemptions ?? 0) })}</div>
        <div className="text-sm text-muted-foreground">{t('till.todayBy')}</div>
      </Link>

      <Dialog open={!!step} onOpenChange={(o) => (o ? null : setStep(null))}>
        <DialogContent className="sm:max-w-md">
          {step ? <TillFlow key={step.kind} step={step} setStep={setStep} me={me} branchId={branchId} onDone={done} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Tile({ icon: Icon, title, hint, disabled, onClick }: { icon: ComponentType<{ className?: string }>; title: string; hint: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-2xl border bg-card px-4 py-7 shadow-xs transition hover:bg-muted/50 focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon className="size-6 text-muted-foreground" />
      <span className="text-lg font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}

const TONE: Record<BranchState, 'success' | 'warning' | 'muted'> = { open: 'success', paused: 'warning', closed: 'muted', unknown: 'muted' };

function StateBadge({ state }: { state: BranchState }) {
  return (
    <Badge variant={TONE[state]} className="h-7 gap-1.5 px-2.5">
      <span className={cn('size-1.5 rounded-full bg-current')} aria-hidden />
      {stateLabel(state)}
    </Badge>
  );
}

/** The dialog's content for one step. Each step is its own mount (key = kind), so state starts fresh. */
function TillFlow({ step, setStep, me, branchId, onDone }: { step: Step; setStep: (s: Step | null) => void; me: StaffMe; branchId: string | null; onDone: () => void }) {
  // Vendor admins have no branch of their own: send the one picked on the till.
  const sendBranch = me.branch ? undefined : (branchId ?? undefined);
  switch (step.kind) {
    case 'scan':
      return <ScanStep step={step} setStep={setStep} />;
    case 'amount':
      return <AmountStep code={step.code} rule={me.activeRule} currency={me.vendor.currency} branchId={sendBranch} setStep={setStep} onDone={onDone} />;
    case 'redeem':
      return <RedeemStep code={step.code} preview={step.preview} branchId={sendBranch} setStep={setStep} onDone={onDone} />;
    case 'collected':
      return (
        <Result title={t('till.granted', { n: num(step.points) })} detail={t('till.grantedFor', { amount: money(step.amount), currency: step.currency })} onNext={() => setStep(null)} />
      );
    case 'given':
      return (
        <Result title={t('till.given', { reward: step.reward })} detail={t('till.givenDetail', { n: num(step.points), balance: num(step.balance) })} onNext={() => setStep(null)} />
      );
  }
}

function ScanStep({ step, setStep }: { step: Extract<Step, { kind: 'scan' }>; setStep: (s: Step) => void }) {
  const [manual, setManual] = useState(step.manual);
  const [typed, setTyped] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false); // the camera sees the same QR many times a second
  const lastBad = useRef<string | null>(null);

  async function check(raw: string) {
    const code = raw.trim();
    if (busy.current || !code || code === lastBad.current) return;
    if (!code.startsWith(QR_PREFIX)) {
      lastBad.current = code;
      setError(t('till.notDvote'));
      return;
    }
    busy.current = true;
    setChecking(true);
    setError(null);
    try {
      const preview = await vendorApi.scanPreview(code);
      if (!preview.usable) {
        const reason = preview.reason ?? 'wrong_qr_type';
        throw new ApiError(409, reason, errorText(reason) ?? t('common.somethingWrong'));
      }
      if (preview.purpose === 'redeem' && preview.redeem) setStep({ kind: 'redeem', code, preview: preview.redeem });
      else if (step.rewardOnly) throw new Error(t('till.notReward'));
      else setStep({ kind: 'amount', code });
    } catch (err) {
      lastBad.current = code;
      setError(errorMessage(err));
    } finally {
      busy.current = false;
      setChecking(false);
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    lastBad.current = null;
    void check(typed);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{step.rewardOnly ? t('till.scanRedeemTitle') : t('till.scanTitle')}</DialogTitle>
        <DialogDescription>{t('till.scanBody')}</DialogDescription>
      </DialogHeader>
      {manual ? (
        <form id="till-manual-code" onSubmit={submit} className="grid gap-4">
          <Field label={t('till.codeLabel')} htmlFor="till-code" hint={t('till.codeHint')}>
            <Input
              id="till-code"
              dir="ltr"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="dvote:q1:…"
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                setError(null);
              }}
            />
          </Field>
        </form>
      ) : (
        <div className="relative">
          <QrScanner onCode={(c) => void check(c)} onBlocked={() => (setManual(true), setError(t('till.cameraBlocked')))} paused={checking} />
          {checking ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45">
              <Loader2 className="size-8 animate-spin text-white" />
            </div>
          ) : null}
        </div>
      )}
      <ErrorAlert error={error} />
      <div data-mobile-dialog-actions className="grid gap-2">
      {manual ? (
        <Button type="submit" form="till-manual-code" disabled={checking || !typed.trim()}>
          {checking ? <Loader2 className="animate-spin" /> : null}
          {t('till.continue')}
        </Button>
      ) : null}
      <Button
        variant="ghost"
        onClick={() => {
          setManual((m) => !m);
          setError(null);
          lastBad.current = null;
        }}
      >
        {manual ? <ScanLine /> : <Keyboard />}
        {manual ? t('till.useCamera') : t('till.type')}
      </Button>
      </div>
    </>
  );
}

function AmountStep({
  code,
  rule,
  currency,
  branchId,
  setStep,
  onDone,
}: {
  code: string;
  rule: Rule | null;
  currency: string;
  branchId?: string;
  setStep: (s: Step) => void;
  onDone: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // One key per bill: a retry after a network error never adds points twice.
  const idempotencyKey = useRef(crypto.randomUUID()).current;
  const minor = parseAmount(text);
  const estimate = minor && rule ? estimatePoints(minor, rule) : null;

  async function grant(e: FormEvent) {
    e.preventDefault();
    if (!minor) return setError(t('till.amountInvalid'));
    setBusy(true);
    setError(null);
    try {
      const r = await vendorApi.collect({ code, amount: minor / 100, branchId, idempotencyKey });
      onDone();
      setStep({ kind: 'collected', points: r.pointsAdded, amount: r.purchaseAmount, currency: r.currency });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={grant} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t('till.amountTitle')}</DialogTitle>
        {rule ? <DialogDescription>{t('till.rule', { spend: money(rule.spendAmount), currency, points: rule.pointsPerSpend })}</DialogDescription> : null}
      </DialogHeader>
      <div className="relative">
        <Input
          aria-label={t('till.amountLabel')}
          inputMode="decimal"
          autoFocus
          dir="ltr"
          placeholder="0"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          className="h-14 pe-16 text-center text-2xl font-semibold tabular-nums"
        />
        <span className="absolute inset-y-0 end-4 flex items-center text-sm text-muted-foreground">{currency}</span>
      </div>
      {estimate !== null ? (
        <p className="text-center text-sm text-muted-foreground">{estimate > 0 ? t('till.estimate', { n: num(estimate) }) : t('till.tooSmall')}</p>
      ) : null}
      <ErrorAlert error={error} />
      <div data-mobile-dialog-actions className="grid">
      <Button type="submit" size="lg" disabled={busy || !minor}>
        {busy ? <Loader2 className="animate-spin" /> : null}
        {t('till.grant')}
      </Button>
      </div>
    </form>
  );
}

function RedeemStep({ code, preview: p, branchId, setStep, onDone }: { code: string; preview: RedeemPreview; branchId?: string; setStep: (s: Step) => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // One key per confirmation: a retry never takes points twice.
  const idempotencyKey = useRef(crypto.randomUUID()).current;

  async function give() {
    setBusy(true);
    setError(null);
    try {
      const r = await vendorApi.redeem({ code, branchId, idempotencyKey });
      onDone();
      setStep({ kind: 'given', reward: r.rewardName, points: r.pointsRedeemed, balance: r.cardBalance });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('till.confirmReward')}</DialogTitle>
      </DialogHeader>
      <div className="overflow-hidden rounded-xl border">
        {p.rewardImageUrl ? <img src={p.rewardImageUrl} alt="" className="h-40 w-full bg-muted object-cover" /> : null}
        <div className="grid gap-1 p-4">
          <div className="text-lg font-semibold">{p.rewardName}</div>
          {p.rewardNameAr ? (
            <div dir="rtl" className="text-muted-foreground">
              {p.rewardNameAr}
            </div>
          ) : null}
          {p.rewardDescription ? <div className="text-sm text-muted-foreground">{p.rewardDescription}</div> : null}
          <div className="mt-1 font-semibold">{t('till.points', { n: num(p.pointsCost) })}</div>
        </div>
      </div>
      <div className="grid gap-1.5 rounded-xl border p-4 text-sm">
        <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('till.customer')}</div>
        <div className="mb-1 text-base font-semibold">{p.customerName ?? t('till.someone')}</div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('till.pointsNow')}</span>
          <span className="tabular-nums">{num(p.balance)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('till.pointsAfter')}</span>
          <span className="font-semibold tabular-nums">{num(p.balanceAfter)}</span>
        </div>
      </div>
      <ErrorAlert error={error} />
      <div data-mobile-dialog-actions className="grid">
      <Button size="lg" onClick={() => void give()} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : null}
        {t('till.give')}
      </Button>
      </div>
    </>
  );
}

function Result({ title, detail, onNext }: { title: string; detail: string; onNext: () => void }) {
  return (
    <div className="grid justify-items-center gap-3 py-4 text-center" aria-live="polite">
      <CheckCircle2 className="size-12 text-success" />
      <DialogTitle className="text-2xl">{title}</DialogTitle>
      <DialogDescription>{detail}</DialogDescription>
      <div data-mobile-dialog-actions className="grid">
      <Button className="mt-3 w-full" size="lg" autoFocus onClick={onNext}>
        {t('till.next')}
      </Button>
      </div>
    </div>
  );
}
