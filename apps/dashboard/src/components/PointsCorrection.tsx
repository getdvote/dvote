import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderIcon as Loader2 } from '@solar-icons/react/linear';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { api, errorMessage } from '../lib/api';
import { num } from './PageHeader';

/** What is being corrected: a whole card (add / take points) or one collect (undo it). */
export type Correction =
  | { kind: 'card'; cardId: string; vendorName: string; balance: number }
  | { kind: 'undo'; eventId: string; vendorName: string; points: number; bill: string | null };

/**
 * Admin point correction. Nothing is edited: the API writes a new "adjust" row in the ledger
 * with the reason and the admin's name, and the customer's app updates at once.
 */
export function PointsCorrectionDialog({ userId, target, onClose }: { userId: string; target: Correction | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'add' | 'take'>('add');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  // One key per opened dialog: a double click or a retry is applied once.
  const [key, setKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!target) return;
    setMode('add');
    setPoints('');
    setReason('');
    setKey(crypto.randomUUID());
  }, [target]);

  const amount = Number(points);
  const validPoints = Number.isInteger(amount) && amount > 0 && amount <= 1_000_000;
  const valid = reason.trim().length >= 3 && (target?.kind === 'undo' || validPoints);

  const save = useMutation({
    mutationFn: () => {
      if (target!.kind === 'undo') return api.reverseEvent(target!.eventId, reason.trim());
      return api.adjustCard(target!.cardId, { delta: mode === 'add' ? amount : -amount, reason: reason.trim(), idempotencyKey: key });
    },
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['user', userId] });
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(`${r.delta > 0 ? '+' : ''}${num(r.delta)} points · new balance ${num(r.cardBalance)}`);
      onClose();
    },
    onError: (e) => void toast.error(errorMessage(e)),
  });

  const after = target?.kind === 'card' && validPoints ? target.balance + (mode === 'add' ? amount : -amount) : null;

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        {target && (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid && !save.isPending) save.mutate();
            }}
          >
            <DialogHeader>
              <DialogTitle>{target.kind === 'undo' ? 'Undo this collect' : 'Adjust points'}</DialogTitle>
              <DialogDescription>
                {target.kind === 'undo'
                  ? `Takes back the ${num(target.points)} points this collect gave at ${target.vendorName}${target.bill ? ` (bill ${target.bill})` : ''}. It can be undone only once.`
                  : `${target.vendorName} · balance now ${num(target.balance)} pts. The balance can't go below 0.`}
              </DialogDescription>
            </DialogHeader>

            {target.kind === 'card' && (
              <div className="grid gap-2">
                <ToggleGroup type="single" variant="outline" value={mode} onValueChange={(v) => v && setMode(v as 'add' | 'take')} className="w-full">
                  <ToggleGroupItem value="add" className="flex-1 data-[state=on]:bg-accent">
                    Add points
                  </ToggleGroupItem>
                  <ToggleGroupItem value="take" className="flex-1 data-[state=on]:bg-accent">
                    Take away
                  </ToggleGroupItem>
                </ToggleGroup>
                <Label htmlFor="adj-points">Points</Label>
                <Input id="adj-points" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 50" autoFocus />
                {after !== null && (
                  <p className={after < 0 ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
                    {after < 0 ? 'Not enough points on this card.' : `New balance: ${num(after)} pts`}
                  </p>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="adj-reason">Reason (kept in the history)</Label>
              <Textarea
                id="adj-reason"
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
                placeholder={target.kind === 'undo' ? 'e.g. Staff typed 950 instead of 95' : 'e.g. Goodwill after a complaint'}
                autoFocus={target.kind === 'undo'}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
                Cancel
              </Button>
              <Button type="submit" variant={target.kind === 'undo' || mode === 'take' ? 'destructive' : 'default'} disabled={!valid || save.isPending || (after !== null && after < 0)}>
                {save.isPending && <Loader2 className="animate-spin" />}
                {target.kind === 'undo' ? 'Undo collect' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
