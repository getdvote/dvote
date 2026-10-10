import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Loader2, Mail, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Field } from '../../components/Field';
import { StatusTag } from '../../components/StatusTag';
import { TableState } from '../../components/TableState';
import { errorMessage, type Branch, type Staff, type StaffRole } from '../../lib/api';
import type { VendorScope } from '../../lib/scope';
import { TabToolbar } from './TabToolbar';

const ROLE: Record<StaffRole, { label: string; variant: 'brand' | 'secondary' | 'outline' }> = {
  vendor_admin: { label: 'Merchant admin', variant: 'brand' },
  branch_manager: { label: 'Branch manager', variant: 'secondary' },
  staff: { label: 'Staff', variant: 'outline' },
};

/** Everyone working at the vendor. The platform invites the vendor admin; they invite the rest. */
export function StaffTab({ scope, selfId }: { scope: VendorScope; selfId?: string }) {
  const qc = useQueryClient();
  const [inviting, setInviting] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ['staff', scope.key], queryFn: () => scope.staff() });
  const { data: branches } = useQuery({ queryKey: ['branches', scope.key], queryFn: () => scope.branches() });
  const branchName = (id: string | null) => (id ? (branches?.find((b) => b.id === id)?.name ?? '—') : 'All branches');
  const onlyAdmins = scope.can.inviteRoles.length === 1 && scope.can.inviteRoles[0] === 'vendor_admin';

  const toggle = useMutation({
    mutationFn: (s: Staff) => scope.updateStaff(s.id, { status: s.status === 'active' ? 'disabled' : 'active' }),
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: ['staff', scope.key] });
      toast.success(s.status === 'active' ? `${s.name} can sign in again` : `${s.name} is disabled`);
    },
    onError: (e) => void toast.error(errorMessage(e)),
  });

  return (
    <>
      <TabToolbar
        hint={
          onlyAdmins
            ? 'Invite the owner as merchant admin; they add managers and staff from their side.'
            : 'People you invite get an email to set a password, then sign in to the staff app.'
        }
      >
        {scope.can.inviteRoles.length ? (
          <Button onClick={() => setInviting(true)}>
            <UserPlus /> {onlyAdmins ? 'Invite merchant admin' : 'Invite'}
          </Button>
        ) : null}
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
                  <div className="font-semibold">
                    {s.name} {s.id === selfId ? <Badge variant="outline">You</Badge> : null}
                  </div>
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
                  {s.id === selfId ? null : (
                    <Button
                      size="sm"
                      variant={s.status === 'active' ? 'destructive' : 'outline'}
                      disabled={toggle.isPending && toggle.variables?.id === s.id}
                      onClick={() => toggle.mutate(s)}
                    >
                      {s.status === 'active' ? 'Disable' : 'Enable'}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <InviteDialog
        scope={scope}
        branches={(branches ?? []).filter((b) => b.status === 'active')}
        open={inviting}
        onClose={() => setInviting(false)}
      />
    </>
  );
}

function InviteDialog({ scope, branches, open, onClose }: { scope: VendorScope; branches: Branch[]; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const roles = scope.can.inviteRoles;
  const [role, setRole] = useState<StaffRole>(roles[0]);
  const [branchId, setBranchId] = useState<string | undefined>();
  const pickBranch = role !== 'vendor_admin' && !scope.can.fixedBranchId;

  const invite = useMutation({
    mutationFn: async (v: { name: string; email: string }) => {
      if (pickBranch && !branchId) throw new Error('Choose a branch.');
      return scope.inviteStaff({
        ...v,
        role,
        branchId: role === 'vendor_admin' ? undefined : (scope.can.fixedBranchId ?? branchId),
      });
    },
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: ['staff', scope.key] });
      void qc.invalidateQueries({ queryKey: ['vendor', scope.key] });
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
          <DialogTitle>{role === 'vendor_admin' ? 'Invite merchant admin' : 'Invite'}</DialogTitle>
          <DialogDescription>They get an email to set their password, then sign in.</DialogDescription>
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
            <Input id="invite-name" name="name" required maxLength={120} pattern=".*\S.*" placeholder="Full name" autoFocus />
          </Field>
          <Field label="Email" htmlFor="invite-email">
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="invite-email" name="email" type="email" required placeholder="name@shop.com" className="pl-9" />
            </div>
          </Field>
          {roles.length > 1 ? (
            <Field label="Role" htmlFor="invite-role" hint="Branch managers run one branch and its staff. Staff only scan in the staff app.">
              <Select value={role} onValueChange={(v) => setRole(v as StaffRole)}>
                <SelectTrigger id="invite-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE[r].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {pickBranch ? (
            <Field label="Branch" htmlFor="invite-branch">
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger id="invite-branch" className="w-full">
                  <SelectValue placeholder="Choose a branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
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
