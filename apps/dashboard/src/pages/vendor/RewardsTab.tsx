import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gift, Loader2, Plus, X } from 'lucide-react';
import { useRef, useState } from 'react';
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
import { errorMessage, type Reward, type RewardBody } from '../../lib/api';
import type { VendorScope } from '../../lib/scope';
import { IMAGE_ACCEPT } from './ImagesTab';
import { RewardAvailability } from './RewardAvailability';
import { TabToolbar } from './TabToolbar';
import { t } from '../../i18n';

/** The reward catalogue (English + Arabic): add, edit price/texts/order, archive / restore. */
export function RewardsTab({ scope }: { scope: VendorScope }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Reward | 'new' | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['rewards', scope.key], queryFn: () => scope.rewards() });
  // Sold out per branch (merchant accounts only). Re-read every minute: timed ones end by themselves.
  const { data: soldOut } = useQuery({
    queryKey: ['soldOut', scope.key],
    queryFn: () => scope.soldOut!.list(),
    enabled: !!scope.soldOut,
    refetchInterval: 60_000,
  });
  const { data: branches } = useQuery({ queryKey: ['branches', scope.key], queryFn: () => scope.branches(), enabled: !!scope.soldOut });
  const openBranches = branches?.filter((b) => b.status === 'active') ?? [];
  const cols = scope.soldOut ? 7 : 6;

  const toggle = useMutation({
    mutationFn: (r: Reward) => scope.updateReward(r.id, { status: r.status === 'active' ? 'archived' : 'active' }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['rewards', scope.key] });
      toast.success(r.status === 'active' ? t('rewards.restoredToast', { name: r.name }) : t('rewards.archivedToast', { name: r.name }));
    },
    onError: (e) => void toast.error(errorMessage(e)),
  });

  return (
    <>
      <TabToolbar
        hint={
          scope.soldOut
            ? t('rewards.hintSoldOut')
            : t('rewards.hint')
        }
      >
        {scope.can.editVendor ? (
          <Button onClick={() => setEditing('new')}>
            <Plus /> {t('rewards.add')}
          </Button>
        ) : null}
      </TabToolbar>
      <ErrorAlert error={error} className="mb-4" />
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 ps-4">#</TableHead>
              <TableHead className="w-20">{t('rewards.photo')}</TableHead>
              <TableHead>{t('rewards.reward')}</TableHead>
              <TableHead className="text-end">{t('rewards.cost')}</TableHead>
              {scope.soldOut ? <TableHead>{t('rewards.availability')}</TableHead> : null}
              <TableHead>{t('common.status')}</TableHead>
              <TableHead className="pe-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableState loading={isLoading} empty={!data?.length} colSpan={cols} emptyText={t('rewards.empty')} />
            {data?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="ps-4 text-muted-foreground tabular-nums">{r.sortOrder}</TableCell>
                <TableCell>
                  <RewardPhoto scope={scope} reward={r} />
                </TableCell>
                <TableCell className="whitespace-normal">
                  {/* both names side by side (a flex gap works whatever the page and span directions) */}
                  <span className="inline-flex flex-wrap items-baseline gap-x-2.5">
                    <span dir="ltr" className="font-semibold">
                      {r.name}
                    </span>
                    {r.nameAr ? (
                      <span dir="rtl" className="text-muted-foreground">
                        {r.nameAr}
                      </span>
                    ) : (
                      <span className="text-xs text-warning">{t('rewards.noArabic')}</span>
                    )}
                  </span>
                  {r.description ? <div className="text-xs text-muted-foreground">{r.description}</div> : null}
                </TableCell>
                <TableCell className="text-end font-semibold tabular-nums">{t('common.pts', { n: r.pointsCost })}</TableCell>
                {scope.soldOut ? (
                  <TableCell>
                    {r.status === 'active' && soldOut && branches ? (
                      <RewardAvailability scope={scope} reward={r} soldOut={soldOut.filter((s) => s.rewardId === r.id)} branches={openBranches} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                ) : null}
                <TableCell>
                  <StatusTag status={r.status} />
                </TableCell>
                <TableCell className="pe-4">
                  <div className={scope.can.editVendor ? 'flex justify-end gap-2' : 'hidden'}>
                    <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                      {t('common.edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant={r.status === 'active' ? 'destructive' : 'outline'}
                      disabled={toggle.isPending && toggle.variables?.id === r.id}
                      onClick={() => toggle.mutate(r)}
                    >
                      {r.status === 'active' ? t('rewards.archive') : t('rewards.restore')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <RewardDialog key={editing === 'new' ? 'new' : editing?.id ?? 'closed'} scope={scope} reward={editing} onClose={() => setEditing(null)} />
    </>
  );
}

/** The reward's photo in the app. Click to upload / replace; X removes it (the file is deleted). */
function RewardPhoto({ scope, reward }: { scope: VendorScope; reward: Reward }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const done = (text: string) => {
    void qc.invalidateQueries({ queryKey: ['rewards', scope.key] });
    toast.success(text);
  };
  const upload = useMutation({
    mutationFn: (f: File) => scope.uploadRewardImage(reward.id, f),
    onSuccess: () => done(t('rewards.photoSaved', { name: reward.name })),
    onError: (e) => void toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => scope.removeRewardImage(reward.id),
    onSuccess: () => done(t('rewards.photoRemoved')),
    onError: (e) => void toast.error(errorMessage(e)),
  });
  const busy = upload.isPending || remove.isPending;
  const canEdit = scope.can.editVendor;

  return (
    <div className="group relative size-14">
      <button
        type="button"
        disabled={!canEdit || busy}
        title={canEdit ? (reward.imageUrl ? t('rewards.replacePhoto') : t('rewards.addPhoto')) : undefined}
        onClick={() => input.current?.click()}
        className="flex size-14 items-center justify-center overflow-hidden rounded-lg border bg-muted text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 enabled:cursor-pointer enabled:hover:border-primary"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : reward.imageUrl ? (
          <img src={reward.imageUrl} alt="" className="size-full object-cover" />
        ) : canEdit ? (
          <Plus className="size-4" />
        ) : (
          <Gift className="size-4" />
        )}
      </button>
      {canEdit && reward.imageUrl && !busy ? (
        <button
          type="button"
          aria-label={t('rewards.removePhoto')}
          onClick={() => remove.mutate()}
          className="absolute -top-1.5 -end-1.5 hidden size-5 items-center justify-center rounded-full border bg-card text-destructive shadow-sm group-hover:flex"
        >
          <X className="size-3" />
        </button>
      ) : null}
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload.mutate(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function RewardDialog({ scope, reward, onClose }: { scope: VendorScope; reward: Reward | 'new' | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isNew = reward === 'new';
  const current = reward && reward !== 'new' ? reward : null;
  const [retail, setRetail] = useState(current?.retailValue ?? '');
  const save = useMutation({
    mutationFn: (body: RewardBody) => (isNew ? scope.createReward(body) : scope.updateReward(current!.id, body)),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['rewards', scope.key] });
      toast.success(isNew ? t('rewards.addedToast', { name: r.name }) : t('common.saved'));
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
          <DialogTitle>{isNew ? t('rewards.add') : t('rewards.edit')}</DialogTitle>
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
              retailValue: String(f.get('retailValue')).trim() ? Number(f.get('retailValue')) : null,
              sortOrder: optionalNumber(f.get('sortOrder')),
            });
          }}
        >
          <Field label={t('rewards.nameEn')} htmlFor="reward-name">
            <Input id="reward-name" name="name" dir="ltr" required maxLength={120} pattern=".*\S.*" defaultValue={current?.name} placeholder="Free coffee" autoFocus />
          </Field>
          <Field label={t('rewards.nameAr')} htmlFor="reward-name-ar">
            <Input id="reward-name-ar" name="nameAr" dir="rtl" maxLength={120} defaultValue={current?.nameAr ?? ''} placeholder="قهوة مجانية" />
          </Field>
          <Field label={t('rewards.descEn')} htmlFor="reward-desc">
            <Textarea id="reward-desc" name="description" dir="ltr" rows={2} maxLength={500} defaultValue={current?.description ?? ''} placeholder="Any coffee, any size" />
          </Field>
          <Field label={t('rewards.descAr')} htmlFor="reward-desc-ar">
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
          <Field label={t('rewards.costLabel')} htmlFor="reward-cost">
            <Input id="reward-cost" name="pointsCost" type="number" required min={1} max={1000000} step={1} defaultValue={current?.pointsCost} />
          </Field>
          <Field label={t('rewards.retailValue', { currency: scope.currency })} htmlFor="reward-retail" hint={t('rewards.retailHint')}>
            <Input id="reward-retail" name="retailValue" type="number" min={0.01} max={99999999.99} step={0.01} value={retail} onChange={(e) => setRetail(e.target.value)} />
          </Field>
          <Field label={t('rewards.order')} htmlFor="reward-order" hint={t('rewards.orderHint')}>
            <Input id="reward-order" name="sortOrder" type="number" min={0} max={10000} step={1} defaultValue={current?.sortOrder ?? ''} placeholder={t('rewards.last')} />
          </Field>
          <ErrorAlert error={save.error} className="sm:col-span-2" />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="reward-form" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            {isNew ? t('rewards.add') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
