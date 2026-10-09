import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Field, optionalNumber } from '../../components/Field';
import { StatusTag } from '../../components/StatusTag';
import { TableState } from '../../components/TableState';
import { errorMessage, type Reward } from '../../lib/api';
import type { VendorScope } from '../../lib/scope';
import { TabToolbar } from './TabToolbar';

/** The reward catalogue (English + Arabic): add, edit price/texts/order, archive / restore. */
export function RewardsTab({ scope }: { scope: VendorScope }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Reward | 'new' | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['rewards', scope.key], queryFn: () => scope.rewards() });

  const toggle = useMutation({
    mutationFn: (r: Reward) => scope.updateReward(r.id, { status: r.status === 'active' ? 'archived' : 'active' }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['rewards', scope.key] });
      toast.success(r.status === 'active' ? `${r.name} restored` : `${r.name} archived`);
    },
    onError: (e) => void toast.error(errorMessage(e)),
  });

  return (
    <>
      <TabToolbar hint="Archived rewards can't be redeemed. A new price applies to future redemptions only.">
        {scope.can.editVendor ? (
          <Button onClick={() => setEditing('new')}>
            <Plus /> Add reward
          </Button>
        ) : null}
      </TabToolbar>
      <ErrorAlert error={error} className="mb-4" />
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 pl-4">#</TableHead>
              <TableHead>Reward</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableState loading={isLoading} empty={!data?.length} colSpan={5} emptyText="No rewards yet" />
            {data?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="pl-4 text-muted-foreground tabular-nums">{r.sortOrder}</TableCell>
                <TableCell className="whitespace-normal">
                  <span className="font-semibold">{r.name}</span>
                  {/* the page is LTR: a physical left margin, since ms-* on a dir="rtl" span lands on its right */}
                  {r.nameAr ? (
                    <span dir="rtl" className="ml-2.5 text-muted-foreground">
                      {r.nameAr}
                    </span>
                  ) : (
                    <span className="ml-2.5 text-xs text-warning">No Arabic name</span>
                  )}
                  {r.description ? <div className="text-xs text-muted-foreground">{r.description}</div> : null}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{r.pointsCost.toLocaleString()} pts</TableCell>
                <TableCell>
                  <StatusTag status={r.status} />
                </TableCell>
                <TableCell className="pr-4">
                  <div className={scope.can.editVendor ? 'flex justify-end gap-2' : 'hidden'}>
                    <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={r.status === 'active' ? 'destructive' : 'outline'}
                      disabled={toggle.isPending && toggle.variables?.id === r.id}
                      onClick={() => toggle.mutate(r)}
                    >
                      {r.status === 'active' ? 'Archive' : 'Restore'}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <RewardDialog scope={scope} reward={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function RewardDialog({ scope, reward, onClose }: { scope: VendorScope; reward: Reward | 'new' | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isNew = reward === 'new';
  const current = reward && reward !== 'new' ? reward : null;
  const save = useMutation({
    mutationFn: (body: Partial<Reward>) => (isNew ? scope.createReward(body) : scope.updateReward(current!.id, body)),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['rewards', scope.key] });
      toast.success(isNew ? `${r.name} added` : 'Saved');
      onClose();
    },
  });
  return (
    <Dialog
      open={reward !== null}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          save.reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Add reward' : 'Edit reward'}</DialogTitle>
        </DialogHeader>
        <form
          id="reward-form"
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const text = (k: string) => String(f.get(k)).trim() || null;
            save.mutate({
              name: String(f.get('name')).trim(),
              nameAr: text('nameAr'),
              description: text('description'),
              descriptionAr: text('descriptionAr'),
              pointsCost: Number(f.get('pointsCost')),
              sortOrder: optionalNumber(f.get('sortOrder')),
            });
          }}
        >
          <Field label="Name (English)" htmlFor="reward-name">
            <Input id="reward-name" name="name" required maxLength={120} pattern=".*\S.*" defaultValue={current?.name} placeholder="Free coffee" autoFocus />
          </Field>
          <Field label="Name (Arabic)" htmlFor="reward-name-ar">
            <Input id="reward-name-ar" name="nameAr" dir="rtl" maxLength={120} defaultValue={current?.nameAr ?? ''} placeholder="قهوة مجانية" />
          </Field>
          <Field label="Description (English)" htmlFor="reward-desc">
            <Textarea id="reward-desc" name="description" rows={2} maxLength={500} defaultValue={current?.description ?? ''} placeholder="Any coffee, any size" />
          </Field>
          <Field label="Description (Arabic)" htmlFor="reward-desc-ar">
            <Textarea
              id="reward-desc-ar"
              name="descriptionAr"
              dir="rtl"
              rows={2}
              maxLength={500}
              defaultValue={current?.descriptionAr ?? ''}
              placeholder="أي قهوة، أي حجم"
            />
          </Field>
          <Field label="Cost (points)" htmlFor="reward-cost">
            <Input id="reward-cost" name="pointsCost" type="number" required min={1} max={1000000} step={1} defaultValue={current?.pointsCost} />
          </Field>
          <Field label="Display order" htmlFor="reward-order" hint="Lower shows first">
            <Input id="reward-order" name="sortOrder" type="number" min={0} max={10000} step={1} defaultValue={current?.sortOrder ?? ''} placeholder="Last" />
          </Field>
          <ErrorAlert error={save.error} className="sm:col-span-2" />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="reward-form" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            {isNew ? 'Add reward' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
