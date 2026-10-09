import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Loader2, Mail, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Field } from '../../components/Field';
import { StatusTag } from '../../components/StatusTag';
import { TableState } from '../../components/TableState';
import { api, errorMessage, type Staff, type StaffRole } from '../../lib/api';
import { TabToolbar } from './TabToolbar';

const ROLE: Record<StaffRole, { label: string; variant: 'brand' | 'secondary' | 'outline' }> = {
  vendor_admin: { label: 'Vendor admin', variant: 'brand' },
  branch_manager: { label: 'Branch manager', variant: 'secondary' },
  staff: { label: 'Staff', variant: 'outline' },
};

/** Everyone working at the vendor. The platform invites the vendor admin; they invite the rest. */
export function StaffTab({ vendorId }: { vendorId: string }) {
  const qc = useQueryClient();
  const [inviting, setInviting] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ['staff', vendorId], queryFn: () => api.staff(vendorId) });
  const { data: branches } = useQuery({ queryKey: ['branches', vendorId], queryFn: () => api.branches(vendorId) });
  const branchName = (id: string | null) => (id ? (branches?.find((b) => b.id === id)?.name ?? '—') : 'All branches');

  const toggle = useMutation({
    mutationFn: (s: Staff) => api.updateStaff(s.id, { status: s.status === 'active' ? 'disabled' : 'active' }),
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: ['staff', vendorId] });
      toast.success(s.status === 'active' ? `${s.name} can sign in again` : `${s.name} is disabled`);
    },
    onError: (e) => void toast.error(errorMessage(e)),
  });

  return (
    <>
      <TabToolbar hint="Invite the owner as vendor admin; they add managers and staff from their side.">
        <Button onClick={() => setInviting(true)}>
          <UserPlus /> Invite vendor admin
        </Button>
      </TabToolbar>
      <ErrorAlert error={error} className="mb-4" />
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableState loading={isLoading} empty={!data?.length} colSpan={6} emptyText="No staff yet" />
            {data?.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="pl-4">
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.email}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={ROLE[s.role].variant}>{ROLE[s.role].label}</Badge>
                </TableCell>
                <TableCell>{branchName(s.branchId)}</TableCell>
                <TableCell>
                  <StatusTag status={s.status} />
                </TableCell>
                <TableCell>{dayjs(s.createdAt).format('D MMM YYYY')}</TableCell>
                <TableCell className="pr-4 text-right">
                  <Button
                    size="sm"
                    variant={s.status === 'active' ? 'destructive' : 'outline'}
                    disabled={toggle.isPending && toggle.variables?.id === s.id}
                    onClick={() => toggle.mutate(s)}
                  >
                    {s.status === 'active' ? 'Disable' : 'Enable'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <InviteDialog vendorId={vendorId} open={inviting} onClose={() => setInviting(false)} />
    </>
  );
}

function InviteDialog({ vendorId, open, onClose }: { vendorId: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const invite = useMutation({
    mutationFn: (v: { name: string; email: string }) => api.inviteVendorAdmin(vendorId, v),
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: ['staff', vendorId] });
      void qc.invalidateQueries({ queryKey: ['vendor', vendorId] });
      toast.success(s.invited ? `Invite email sent to ${s.email}` : `${s.email} already had an account: linked, no email sent`);
      onClose();
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          invite.reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite vendor admin</DialogTitle>
          <DialogDescription>They get an email to set their password, then sign in to the staff app and the dashboard.</DialogDescription>
        </DialogHeader>
        <form
          id="invite-form"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            invite.mutate({ name: String(f.get('name')).trim(), email: String(f.get('email')).trim() });
          }}
        >
          <Field label="Name" htmlFor="invite-name">
            <Input id="invite-name" name="name" required maxLength={120} pattern=".*\S.*" placeholder="Owner's name" autoFocus />
          </Field>
          <Field label="Email" htmlFor="invite-email">
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="invite-email" name="email" type="email" required placeholder="owner@shop.com" className="pl-9" />
            </div>
          </Field>
          <ErrorAlert error={invite.error} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="invite-form" disabled={invite.isPending}>
            {invite.isPending ? <Loader2 className="animate-spin" /> : null}
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
