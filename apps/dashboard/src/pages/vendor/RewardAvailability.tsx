import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { AltArrowDownIcon as ChevronDown, CheckCircleIcon as CircleCheck, SlashCircleIcon as CircleSlash, LoaderIcon as Loader2 } from '@solar-icons/react/linear';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { errorMessage, type Branch, type Reward, type SoldOut } from '../../lib/api';
import type { VendorScope } from '../../lib/scope';
import { localized, t } from '../../i18n';

/** How long "sold out" lasts; null = until someone puts it back on sale. */
const DURATIONS: { key: 'h2' | 'h4' | 'today' | 'manual'; until: () => string | null }[] = [
  { key: 'h2', until: () => dayjs().add(2, 'hour').toISOString() },
  { key: 'h4', until: () => dayjs().add(4, 'hour').toISOString() },
  { key: 'today', until: () => dayjs().endOf('day').toISOString() },
  { key: 'manual', until: () => null },
];

const backText = (until: string | null) => {
  if (!until) return null;
  const at = dayjs(until);
  return t('availability.back', { time: at.isSame(dayjs(), 'day') ? at.format('HH:mm') : at.format('D MMM, HH:mm') });
};

/**
 * A reward's availability on its row: a pill (Available / Sold out …) that opens the choices.
 * A branch manager changes their own branch; a merchant admin picks a branch or all of them.
 * Timed sold-outs end by themselves; the customer app shows where it's sold out, and staff at
 * that branch can't give it.
 */
export function RewardAvailability({
  scope,
  reward,
  soldOut,
  branches,
}: {
  scope: VendorScope;
  reward: Reward;
  /** This reward's current sold-outs (open branches only). */
  soldOut: SoldOut[];
  /** Open branches. */
  branches: Branch[];
}) {
  const qc = useQueryClient();
  const api = scope.soldOut!;
  const fixed = api.fixedBranchId;
  const mine = fixed ? soldOut.filter((s) => s.branchId === fixed) : soldOut;
  const where = (branchId?: string) =>
    branchId ? (branches.find((b) => b.id === branchId)?.name ?? t('availability.yourBranch')) : t('availability.everyBranch');
  const name = localized(reward.name, reward.nameAr);

  const done = (text: string) => {
    void qc.invalidateQueries({ queryKey: ['soldOut', scope.key] });
    toast.success(text);
  };
  const set = useMutation({
    mutationFn: (v: { branchId?: string; until: string | null }) => api.set(reward.id, v),
    onSuccess: (_, v) => {
      const back = backText(v.until);
      done(t('availability.soldOutToast', { name, where: where(v.branchId) }) + (back ? `, ${back}` : ''));
    },
    onError: (e) => void toast.error(errorMessage(e)),
  });
  const clear = useMutation({
    mutationFn: (branchId?: string) => api.clear(reward.id, branchId),
    onSuccess: (_, branchId) => done(t('availability.backToast', { name, where: where(branchId) })),
    onError: (e) => void toast.error(errorMessage(e)),
  });
  const busy = set.isPending || clear.isPending;

  // What the pill says.
  let label = t('availability.available');
  if (mine.length) {
    if (fixed || branches.length === 1) label = [t('availability.soldOut'), backText(mine[0].until)].filter(Boolean).join(' · ');
    else if (mine.length >= branches.length) label = t('availability.soldOutEverywhere');
    else if (mine.length === 1) label = t('availability.soldOutAt', { branch: mine[0].branchName });
    else label = t('availability.soldOutAtN', { n: mine.length, total: branches.length });
  }

  /** "Back on sale" + the durations, for one branch or (no branchId) all of them. */
  const choices = (branchId: string | undefined, isSoldOut: boolean) => (
    <>
      {isSoldOut ? (
        <>
          <DropdownMenuItem onSelect={() => clear.mutate(branchId)}>
            <CircleCheck className="text-success" /> {t('availability.backNow')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t('branchNow.changeHowLong')}</DropdownMenuLabel>
        </>
      ) : null}
      {DURATIONS.map((d) => (
        <DropdownMenuItem key={d.key} onSelect={() => set.mutate({ branchId, until: d.until() })}>
          {isSoldOut ? null : <CircleSlash className="text-warning" />}
          {isSoldOut ? t(`availability.for.${d.key}`) : t(`availability.soldOutFor.${d.key}`)}
        </DropdownMenuItem>
      ))}
    </>
  );

  if (!branches.length) return <span className="text-sm text-muted-foreground">{t('availability.noBranch')}</span>;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={busy}>
        <button
          type="button"
          className="rounded-4xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={t('availability.change', { name, state: label })}
        >
          <Badge variant={mine.length ? 'warning' : 'success'} className="h-6 cursor-pointer gap-1 pe-1.5">
            {busy ? <Loader2 className="animate-spin" /> : mine.length ? <CircleSlash /> : <CircleCheck />}
            {label}
            <ChevronDown />
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {fixed || branches.length === 1 ? (
          <>
            <DropdownMenuLabel>{fixed ? where(fixed) : branches[0].name}</DropdownMenuLabel>
            {choices(fixed ?? branches[0].id, mine.length > 0)}
          </>
        ) : (
          <>
            <DropdownMenuLabel>{t('common.allBranches')}</DropdownMenuLabel>
            {soldOut.length ? (
              <DropdownMenuItem onSelect={() => clear.mutate(undefined)}>
                <CircleCheck className="text-success" /> {t('availability.backEverywhere')}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <CircleSlash className="text-warning" /> {t('availability.soldOutEverywhere')}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">{choices(undefined, false)}</DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('availability.oneBranch')}</DropdownMenuLabel>
            {branches.map((b) => {
              const row = soldOut.find((s) => s.branchId === b.id);
              return (
                <DropdownMenuSub key={b.id}>
                  <DropdownMenuSubTrigger>
                    <span className="flex-1 truncate">{b.name}</span>
                    <span className={row ? 'text-xs text-warning' : 'text-xs text-muted-foreground'}>
                      {row ? (backText(row.until) ?? t('availability.soldOut')) : t('availability.available')}
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52">{choices(b.id, !!row)}</DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
