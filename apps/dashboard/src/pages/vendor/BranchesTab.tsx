import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Images, Loader2, MapPin, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Field } from '../../components/Field';
import { LocationPicker, type LatLng, type PlaceAddress } from '../../components/LocationPicker';
import { StatusTag } from '../../components/StatusTag';
import { WeeklyHoursEditor } from '../../components/WeeklyHoursEditor';
import { TableState } from '../../components/TableState';
import { errorMessage, type Branch, type HoursSlot } from '../../lib/api';
import { hoursSummary } from '../../lib/hours';
import { cityLabel, cityName, citiesSorted, type CityKey } from '../../lib/cities';
import { t } from '../../i18n';
import type { VendorScope } from '../../lib/scope';
import { BranchNow } from './BranchNow';
import { BranchPhotos, StagedBranchPhotos } from './ImagesTab';
import { TabToolbar } from './TabToolbar';

const NO_CITY = 'none';

/** The vendor's shops: add, edit (address, location picked on a map), photos, close / reopen. */
export function BranchesTab({ scope }: { scope: VendorScope }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Branch | 'new' | null>(null);
  const [photosOf, setPhotosOf] = useState<Branch | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['branches', scope.key], queryFn: () => scope.branches() });
  const { data: images } = useQuery({ queryKey: ['images', scope.key], queryFn: () => scope.images() });
  const photoCount = (branchId: string) => images?.filter((i) => i.kind === 'branch_photo' && i.branchId === branchId).length ?? 0;

  const toggle = useMutation({
    mutationFn: (b: Branch) => scope.updateBranch(b.id, { status: b.status === 'active' ? 'closed' : 'active' }),
    onSuccess: (b) => {
      void qc.invalidateQueries({ queryKey: ['branches', scope.key] });
      void qc.invalidateQueries({ queryKey: ['vendor', scope.key] });
      toast.success(b.status === 'active' ? t('branches.reopenedToast', { name: b.name }) : t('branches.closedToast', { name: b.name }));
    },
    onError: (e) => void toast.error(errorMessage(e)),
  });

  return (
    <>
      <TabToolbar hint={t('branches.hint')}>
        {scope.can.editVendor ? (
          <Button onClick={() => setEditing('new')}>
            <Plus /> {t('branches.add')}
          </Button>
        ) : null}
      </TabToolbar>
      <ErrorAlert error={error} className="mb-4" />
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4">{t('common.branch')}</TableHead>
              <TableHead>{t('branches.address')}</TableHead>
              <TableHead>{t('branches.map')}</TableHead>
              <TableHead>{t('branches.photos')}</TableHead>
              <TableHead>{t('branches.now')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
              <TableHead className="pe-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableState loading={isLoading} empty={!data?.length} colSpan={7} emptyText={t('branches.empty')} />
            {data?.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="ps-4">
                  <div className="font-semibold">{b.name}</div>
                  {hoursSummary(b.hours) ? <div className="text-xs text-muted-foreground tabular-nums">{hoursSummary(b.hours)}</div> : null}
                </TableCell>
                <TableCell className="max-w-xs whitespace-normal">
                  {b.address || b.city ? [b.address, cityName(b.city)].filter(Boolean).join(', ') : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  {b.lat !== null && b.lng !== null ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <MapPin className="size-3.5" /> <span dir="ltr">{b.lat.toFixed(4)}, {b.lng.toFixed(4)}</span>
                    </a>
                  ) : (
                    <span className="text-muted-foreground">{t('branches.notSet')}</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => setPhotosOf(b)}>
                    <Images /> {photoCount(b.id)}
                  </Button>
                </TableCell>
                <TableCell>
                  <BranchNow scope={scope} branch={b} />
                </TableCell>
                <TableCell>
                  <StatusTag status={b.status} />
                </TableCell>
                <TableCell className="pe-4">
                  <div className={scope.can.editVendor ? 'flex justify-end gap-2' : 'hidden'}>
                    <Button size="sm" variant="outline" onClick={() => setEditing(b)}>
                      {t('common.edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant={b.status === 'active' ? 'destructive' : 'outline'}
                      disabled={toggle.isPending && toggle.variables?.id === b.id}
                      onClick={() => toggle.mutate(b)}
                    >
                      {b.status === 'active' ? t('branches.close') : t('branches.reopen')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <BranchDialog scope={scope} branch={editing} onClose={() => setEditing(null)} />
      <Dialog open={photosOf !== null} onOpenChange={(o) => !o && setPhotosOf(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('branches.photosOf', { name: photosOf?.name ?? '' })}</DialogTitle>
            <DialogDescription>{t('branches.photosText')}</DialogDescription>
          </DialogHeader>
          {photosOf ? <BranchPhotos scope={scope} branchId={photosOf.id} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function BranchDialog({ scope, branch, onClose }: { scope: VendorScope; branch: Branch | 'new' | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isNew = branch === 'new';
  const current = branch && branch !== 'new' ? branch : null;
  const [location, setLocation] = useState<LatLng | null>(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState<CityKey | null>(null);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [hours, setHours] = useState<HoursSlot[]>([]);
  // Start from the branch's saved location and address each time the dialog opens.
  const [openedFor, setOpenedFor] = useState<Branch | 'new' | null>(null);
  if (branch !== openedFor) {
    setOpenedFor(branch);
    setLocation(current && current.lat !== null && current.lng !== null ? { lat: current.lat, lng: current.lng } : null);
    setAddress(current?.address ?? '');
    setCity(current?.city ?? null);
    setNewPhotos([]);
    setHours(current?.hours ?? []);
  }
  // The map only fills empty fields; it never overwrites what's typed or picked.
  const fillAddress = (found: PlaceAddress) => {
    if (found.line) setAddress((a) => (a.trim() ? a : found.line!));
    if (found.city) setCity((c) => c ?? found.city);
  };
  const save = useMutation({
    mutationFn: async (body: Pick<Branch, 'name' | 'address' | 'city' | 'lat' | 'lng' | 'hours'>) => {
      if (!isNew) return { branch: await scope.updateBranch(current!.id, body), failed: 0 };
      // A new branch's photos can only upload once it exists.
      const branch = await scope.createBranch(body);
      let failed = 0;
      for (const file of newPhotos) {
        await scope.uploadImage(file, 'branch_photo', branch.id).catch(() => failed++);
      }
      return { branch, failed };
    },
    onSuccess: ({ branch, failed }) => {
      void qc.invalidateQueries({ queryKey: ['branches', scope.key] });
      void qc.invalidateQueries({ queryKey: ['vendor', scope.key] });
      void qc.invalidateQueries({ queryKey: ['images', scope.key] });
      toast.success(isNew ? t('branches.addedToast', { name: branch.name }) : t('common.saved'));
      if (failed) toast.error(t('branches.photosFailed', { count: failed }));
      onClose();
    },
  });
  return (
    <Dialog
      open={branch !== null}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          save.reset();
        }
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? t('branches.add') : t('branches.edit')}</DialogTitle>
        </DialogHeader>
        <form
          id="branch-form"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({
              name: String(f.get('name')).trim(),
              address: String(f.get('address')).trim() || null,
              city,
              lat: location?.lat ?? null,
              lng: location?.lng ?? null,
              hours,
            });
          }}
        >
          <Field label={t('branches.name')} htmlFor="branch-name">
            <Input id="branch-name" name="name" required maxLength={120} pattern=".*\S.*" defaultValue={current?.name} placeholder={t('branches.namePlaceholder')} autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
            <Field label={t('branches.address')} htmlFor="branch-address">
              <Textarea
                id="branch-address"
                name="address"
                rows={2}
                maxLength={500}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t('branches.addressPlaceholder')}
              />
            </Field>
            <Field label={t('branches.city')} htmlFor="branch-city">
              <Select value={city ?? NO_CITY} onValueChange={(v) => setCity(v === NO_CITY ? null : (v as CityKey))}>
                <SelectTrigger id="branch-city" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NO_CITY}>{t('branches.notSet')}</SelectItem>
                  {citiesSorted().map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {cityLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <WeeklyHoursEditor value={hours} onChange={setHours} />
          <div className="grid gap-2">
            <span className="text-sm font-medium">{t('branches.location')}</span>
            <LocationPicker value={location} onChange={setLocation} onAddress={fillAddress} />
          </div>
          <div className="grid gap-2">
            <span className="text-sm font-medium">{t('branches.photos')}</span>
            {current ? <BranchPhotos scope={scope} branchId={current.id} /> : <StagedBranchPhotos files={newPhotos} onChange={setNewPhotos} />}
          </div>
          <ErrorAlert error={save.error} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="branch-form" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            {isNew ? t('branches.add') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
