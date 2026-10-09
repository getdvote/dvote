import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MapPin, Plus } from 'lucide-react';
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
import { errorMessage, type Branch } from '../../lib/api';
import type { VendorScope } from '../../lib/scope';
import { TabToolbar } from './TabToolbar';

/** The vendor's shops: add, edit (address, map location), close / reopen. */
export function BranchesTab({ scope }: { scope: VendorScope }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Branch | 'new' | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['branches', scope.key], queryFn: () => scope.branches() });

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
              <TableHead>Status</TableHead>
              <TableHead className="pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableState loading={isLoading} empty={!data?.length} colSpan={5} emptyText="No branches yet" />
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
    </>
  );
}

function BranchDialog({ scope, branch, onClose }: { scope: VendorScope; branch: Branch | 'new' | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isNew = branch === 'new';
  const current = branch && branch !== 'new' ? branch : null;
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
      <DialogContent className="sm:max-w-md">
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
              lat: optionalNumber(f.get('lat')) ?? null,
              lng: optionalNumber(f.get('lng')) ?? null,
            });
          }}
        >
          <Field label="Branch name" htmlFor="branch-name">
            <Input id="branch-name" name="name" required maxLength={120} pattern=".*\S.*" defaultValue={current?.name} placeholder="e.g. Joy Corner Smouha" autoFocus />
          </Field>
          <Field label="Address" htmlFor="branch-address">
            <Textarea id="branch-address" name="address" rows={2} maxLength={500} defaultValue={current?.address ?? ''} placeholder="Street, area, city" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" htmlFor="branch-lat">
              <Input id="branch-lat" name="lat" type="number" min={-90} max={90} step="any" defaultValue={current?.lat ?? ''} placeholder="31.2156" />
            </Field>
            <Field label="Longitude" htmlFor="branch-lng">
              <Input id="branch-lng" name="lng" type="number" min={-180} max={180} step="any" defaultValue={current?.lng ?? ''} placeholder="29.9553" />
            </Field>
          </div>
          <p className="-mt-1 text-xs text-muted-foreground">Tip: in Google Maps, right-click the shop and click the numbers to copy them.</p>
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
