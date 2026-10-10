import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { ChevronDown, CircleCheck, Loader2, PauseCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { errorMessage, type Branch } from '../../lib/api';
import { branchState, STATE_LABEL, type BranchState } from '../../lib/hours';
import type { VendorScope } from '../../lib/scope';

const DURATIONS: { label: string; until: () => string }[] = [
  { label: '30 minutes', until: () => dayjs().add(30, 'minute').toISOString() },
  { label: '1 hour', until: () => dayjs().add(1, 'hour').toISOString() },
  { label: '2 hours', until: () => dayjs().add(2, 'hour').toISOString() },
  { label: 'Rest of today', until: () => dayjs().endOf('day').toISOString() },
];

const VARIANT: Record<BranchState, 'success' | 'warning' | 'secondary' | 'outline'> = {
  open: 'success',
  paused: 'warning',
  closed: 'secondary',
  unknown: 'outline',
};

/**
 * A branch's state right now (open / closed by its hours / temporarily closed) as a pill. Who
 * may pause it (merchant admin: any branch; manager: their own) gets the "temporarily closed"
 * choices from it. Customers see it on the shop page; it ends by itself.
 */
export function BranchNow({ scope, branch }: { scope: VendorScope; branch: Branch }) {
  const qc = useQueryClient();
  const api = scope.branchPause;
  const canPause = !!api && (api.fixedBranchId === null || api.fixedBranchId === branch.id);
  const state = branchState(branch);
  const label = state === 'paused' ? `Closed until ${dayjs(branch.pausedUntil).format('HH:mm')}` : STATE_LABEL[state];

  const done = (text: string) => {
    void qc.invalidateQueries({ queryKey: ['branches', scope.key] });
    toast.success(text);
  };
  const pause = useMutation({
    mutationFn: (until: string) => api!.pause(branch.id, until),
    onSuccess: (b) => done(`${b.name} is temporarily closed until ${dayjs(b.pausedUntil).format('HH:mm')}`),
    onError: (e) => void toast.error(errorMessage(e)),
  });
  const resume = useMutation({
    mutationFn: () => api!.resume(branch.id),
    onSuccess: (b) => done(`${b.name} is open again`),
    onError: (e) => void toast.error(errorMessage(e)),
  });
  const busy = pause.isPending || resume.isPending;

  if (branch.status !== 'active') return <span className="text-muted-foreground">—</span>;
  const pill = (
    <Badge variant={VARIANT[state]} className={canPause ? 'h-6 cursor-pointer gap-1 pr-1.5' : 'h-6 gap-1'}>
      {busy ? <Loader2 className="animate-spin" /> : state === 'paused' ? <PauseCircle /> : null}
      {label}
      {canPause ? <ChevronDown /> : null}
    </Badge>
  );
  if (!canPause) return pill;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={busy}>
        <button type="button" className="rounded-4xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={`${branch.name}: ${label}. Change`}>
          {pill}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {state === 'paused' ? (
          <>
            <DropdownMenuItem onSelect={() => resume.mutate()}>
              <CircleCheck className="text-success" /> Open again now
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {state === 'paused' ? 'Change how long' : 'Temporarily closed for'}
        </DropdownMenuLabel>
        {DURATIONS.map((d) => (
          <DropdownMenuItem key={d.label} onSelect={() => pause.mutate(d.until())}>
            <PauseCircle className="text-warning" /> {d.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
