import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { ChevronDown, CircleCheck, CircleSlash, Loader2 } from 'lucide-react';
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

/** How long "sold out" lasts; null = until someone puts it back on sale. */
const DURATIONS: { label: string; until: () => string | null }[] = [
  { label: 'For 2 hours', until: () => dayjs().add(2, 'hour').toISOString() },
  { label: 'For 4 hours', until: () => dayjs().add(4, 'hour').toISOString() },
  { label: 'Rest of today', until: () => dayjs().endOf('day').toISOString() },
  { label: 'Until I put it back', until: () => null },
];

const backText = (until: string | null) => {
  if (!until) return null;
  const at = dayjs(until);
  return at.isSame(dayjs(), 'day') ? `back ${at.format('HH:mm')}` : `back ${at.format('D MMM, HH:mm')}`;
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
  const where = (branchId?: string) => (branchId ? (branches.find((b) => b.id === branchId)?.name ?? 'your branch') : 'every branch');

  const done = (text: string) => {
    void qc.invalidateQueries({ queryKey: ['soldOut', scope.key] });
    toast.success(text);
  };
  const set = useMutation({
    mutationFn: (v: { branchId?: string; until: string | null }) => api.set(reward.id, v),
    onSuccess: (_, v) => {
      const back = backText(v.until);
      done(`${reward.name} sold out at ${where(v.branchId)}${back ? `, ${back}` : ''}`);
    },
    onError: (e) => void toast.error(errorMessage(e)),
  });
  const clear = useMutation({
    mutationFn: (branchId?: string) => api.clear(reward.id, branchId),
    onSuccess: (_, branchId) => done(`${reward.name} is back on sale at ${where(branchId)}`),
    onError: (e) => void toast.error(errorMessage(e)),
  });
  const busy = set.isPending || clear.isPending;

  // What the pill says.
  let label = 'Available';
  if (mine.length) {
    if (fixed || branches.length === 1) label = ['Sold out', backText(mine[0].until)].filter(Boolean).join(' · ');
    else if (mine.length >= branches.length) label = 'Sold out everywhere';
    else if (mine.length === 1) label = `Sold out at ${mine[0].branchName}`;
    else label = `Sold out at ${mine.length} of ${branches.length}`;
  }

  /** "Back on sale" + the durations, for one branch or (no branchId) all of them. */
  const choices = (branchId: string | undefined, isSoldOut: boolean) => (
    <>
      {isSoldOut ? (
        <>
          <DropdownMenuItem onSelect={() => clear.mutate(branchId)}>
            <CircleCheck className="text-success" /> Back on sale now
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Change how long</DropdownMenuLabel>
        </>
      ) : null}
      {DURATIONS.map((d) => (
        <DropdownMenuItem key={d.label} onSelect={() => set.mutate({ branchId, until: d.until() })}>
          {isSoldOut ? null : <CircleSlash className="text-warning" />}
          {isSoldOut ? d.label : `Sold out ${d.label.toLowerCase()}`}
        </DropdownMenuItem>
      ))}
    </>
  );

  if (!branches.length) return <span className="text-sm text-muted-foreground">No open branch</span>;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={busy}>
        <button
          type="button"
          className="rounded-4xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={`${reward.name}: ${label}. Change availability`}
        >
          <Badge variant={mine.length ? 'warning' : 'success'} className="h-6 cursor-pointer gap-1 pr-1.5">
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
            <DropdownMenuLabel>All branches</DropdownMenuLabel>
            {soldOut.length ? (
              <DropdownMenuItem onSelect={() => clear.mutate(undefined)}>
                <CircleCheck className="text-success" /> Back on sale everywhere
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <CircleSlash className="text-warning" /> Sold out everywhere
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">{choices(undefined, false)}</DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>One branch</DropdownMenuLabel>
            {branches.map((b) => {
              const row = soldOut.find((s) => s.branchId === b.id);
              return (
                <DropdownMenuSub key={b.id}>
                  <DropdownMenuSubTrigger>
                    <span className="flex-1 truncate">{b.name}</span>
                    <span className={row ? 'text-xs text-warning' : 'text-xs text-muted-foreground'}>
                      {row ? (backText(row.until) ?? 'Sold out') : 'Available'}
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
