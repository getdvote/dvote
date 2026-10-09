import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Images, Loader2, MapPin, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Field } from '../../components/Field';
import { LocationPicker, type LatLng } from '../../components/LocationPicker';
import { StatusTag } from '../../components/StatusTag';
import { TableState } from '../../components/TableState';
import { errorMessage, type Branch } from '../../lib/api';
import type { VendorScope } from '../../lib/scope';
import { BranchPhotos } from './ImagesTab';
import { TabToolbar } from './TabToolbar';

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
      toast.success(b.status === 'active' ? `${b.name} reopened` : `${b.name} closed`);
    },
    onError: (e) => void toast.error(errorMessage(e)),
  });

  return (
    <>
      <TabToolbar hint="Customers see open branches on the shop page, with directions.">
        {scope.can.editVendor ? (
          <Button onClick={() => setEditing('new')}>
            <Plus /> Add branch
          </Button>
        ) : null}
      </TabToolbar>
      <ErrorAlert error={error} className="mb-4" />
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Branch</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Map</TableHead>
              <TableHead>Photos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableState loading={isLoading} empty={!data?.length} colSpan={6} emptyText="No branches yet" />
            {data?.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="pl-4 font-semibold">{b.name}</TableCell>
                <TableCell className="max-w-xs whitespace-normal">{b.address ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  {b.lat !== null && b.lng !== null ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <MapPin className="size-3.5" /> {b.lat.toFixed(4)}, {b.lng.toFixed(4)}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Not set</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => setPhotosOf(b)}>
                    <Images /> {photoCount(b.id)}
                  </Button>
                </TableCell>
                <TableCell>
                  <StatusTag status={b.status} />
                </TableCell>
                <TableCell className="pr-4">
                  <div className={scope.can.editVendor ? 'flex justify-end gap-2' : 'hidden'}>
                    <Button size="sm" variant="outline" onClick={() => setEditing(b)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={b.status === 'active' ? 'destructive' : 'outline'}
                      disabled={toggle.isPending && toggle.variables?.id === b.id}
                      onClick={() => toggle.mutate(b)}
                    >
                      {b.status === 'active' ? 'Close' : 'Reopen'}
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
            <DialogTitle>{photosOf?.name} · photos</DialogTitle>
            <DialogDescription>Shown on the shop page in the app, with the branch's directions.</DialogDescription>
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
  // Start from the branch's saved location and address each time the dialog opens.
  const [openedFor, setOpenedFor] = useState<Branch | 'new' | null>(null);
  if (branch !== openedFor) {
    setOpenedFor(branch);
    setLocation(current && current.lat !== null && current.lng !== null ? { lat: current.lat, lng: current.lng } : null);
    setAddress(current?.address ?? '');
  }
  const save = useMutation({
    mutationFn: (body: { name: string; address: string | null; lat: number | null; lng: number | null }) =>
      isNew ? scope.createBranch(body) : scope.updateBranch(current!.id, body),
    onSuccess: (b) => {
      void qc.invalidateQueries({ queryKey: ['branches', scope.key] });
      void qc.invalidateQueries({ queryKey: ['vendor', scope.key] });
      toast.success(isNew ? `${b.name} added` : 'Saved');
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
          <DialogTitle>{isNew ? 'Add branch' : 'Edit branch'}</DialogTitle>
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
              lat: location?.lat ?? null,
              lng: location?.lng ?? null,
            });
          }}
        >
          <Field label="Branch name" htmlFor="branch-name">
            <Input id="branch-name" name="name" required maxLength={120} pattern=".*\S.*" defaultValue={current?.name} placeholder="e.g. Joy Corner Smouha" autoFocus />
          </Field>
          <Field label="Address" htmlFor="branch-address">
            <Textarea id="branch-address" name="address" rows={2} maxLength={500} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, area, city" />
          </Field>
          <div className="grid gap-2">
            <span className="text-sm font-medium">Location on the map</span>
            {/* The map only fills an empty address; it never overwrites what's typed. */}
            <LocationPicker value={location} onChange={setLocation} onAddress={(line) => setAddress((a) => (a.trim() ? a : line))} />
          </div>
          <ErrorAlert error={save.error} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="branch-form" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            {isNew ? 'Add branch' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
