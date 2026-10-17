import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { LoaderIcon as Loader2, LetterIcon as Mail, UserPlusIcon as UserPlus } from '@solar-icons/react/linear';
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
import { t } from '../../i18n';

const ROLE: Record<StaffRole, 'brand' | 'secondary' | 'outline'> = {
  vendor_admin: 'brand',
  branch_manager: 'secondary',
  staff: 'outline',
};
const roleLabel = (r: StaffRole) => t(`staff.roles.${r}`);

/** Everyone working at the vendor. The platform invites the vendor admin; they invite the rest. */
export function StaffTab({ scope, selfId }: { scope: VendorScope; selfId?: string }) {
  const qc = useQueryClient();
  const [inviting, setInviting] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ['staff', scope.key], queryFn: () => scope.staff() });
  const { data: branches } = useQuery({ queryKey: ['branches', scope.key], queryFn: () => scope.branches() });
  const branchName = (id: string | null) => (id ? (branches?.find((b) => b.id === id)?.name ?? '—') : t('common.allBranches'));
  const onlyAdmins = scope.can.inviteRoles.length === 1 && scope.can.inviteRoles[0] === 'vendor_admin';

  const toggle = useMutation({
    mutationFn: (s: Staff) => scope.updateStaff(s.id, { status: s.status === 'active' ? 'disabled' : 'active' }),
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: ['staff', scope.key] });
      toast.success(s.status === 'active' ? t('staff.enabledToast', { name: s.name }) : t('staff.disabledToast', { name: s.name }));
    },
    onError: (e) => void toast.error(errorMessage(e)),
  });

  return (
    <>
      <TabToolbar
        hint={
          onlyAdmins
            ? t('staff.hintAdmins')
            : t('staff.hint')
        }
      >
        {scope.can.inviteRoles.length ? (
          <Button onClick={() => setInviting(true)}>
            <UserPlus /> {onlyAdmins ? t('staff.inviteAdmin') : t('staff.invite')}
          </Button>
        ) : null}
      </TabToolbar>
      <ErrorAlert error={error} className="mb-4" />
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4">{t('common.name')}</TableHead>
              <TableHead>{t('staff.role')}</TableHead>
              <TableHead>{t('common.branch')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
              <TableHead>{t('staff.added')}</TableHead>
              <TableHead className="pe-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableState loading={isLoading} empty={!data?.length} colSpan={6} emptyText={t('staff.empty')} />
            {data?.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="ps-4">
                  <div className="font-semibold">
                    {s.name} {s.id === selfId ? <Badge variant="outline">{t('staff.you')}</Badge> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">{s.email}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={ROLE[s.role]}>{roleLabel(s.role)}</Badge>
                </TableCell>
                <TableCell>{branchName(s.branchId)}</TableCell>
                <TableCell>
                  <StatusTag status={s.status} />
                </TableCell>
                <TableCell>{dayjs(s.createdAt).format('D MMM YYYY')}</TableCell>
                <TableCell className="pe-4 text-end">
                  {s.id === selfId ? null : (
                    <Button
                      size="sm"
                      variant={s.status === 'active' ? 'destructive' : 'outline'}
                      disabled={toggle.isPending && toggle.variables?.id === s.id}
                      onClick={() => toggle.mutate(s)}
                    >
                      {s.status === 'active' ? t('staff.disable') : t('staff.enable')}
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
      if (pickBranch && !branchId) throw new Error(t('staff.chooseBranchError'));
      return scope.inviteStaff({
        ...v,
        role,
        branchId: role === 'vendor_admin' ? undefined : (scope.can.fixedBranchId ?? branchId),
      });
    },
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: ['staff', scope.key] });
      void qc.invalidateQueries({ queryKey: ['vendor', scope.key] });
      toast.success(s.invited ? t('staff.invitedToast', { email: s.email }) : t('staff.linkedToast', { email: s.email }));
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
          <DialogTitle>{role === 'vendor_admin' ? t('staff.inviteAdmin') : t('staff.invite')}</DialogTitle>
          <DialogDescription>{t('staff.inviteText')}</DialogDescription>
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
          <Field label={t('common.name')} htmlFor="invite-name">
            <Input id="invite-name" name="name" required maxLength={120} pattern=".*\S.*" placeholder={t('staff.fullName')} autoFocus />
          </Field>
          <Field label={t('staff.email')} htmlFor="invite-email">
            <div className="relative">
              <Mail className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="invite-email" name="email" type="email" required placeholder="name@shop.com" className="ps-9" />
            </div>
          </Field>
          {roles.length > 1 ? (
            <Field label={t('staff.role')} htmlFor="invite-role" hint={t('staff.roleHint')}>
              <Select value={role} onValueChange={(v) => setRole(v as StaffRole)}>
                <SelectTrigger id="invite-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleLabel(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {pickBranch ? (
            <Field label={t('common.branch')} htmlFor="invite-branch">
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger id="invite-branch" className="w-full">
                  <SelectValue placeholder={t('staff.chooseBranch')} />
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
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="invite-form" disabled={invite.isPending}>
            {invite.isPending ? <Loader2 className="animate-spin" /> : null}
            {t('staff.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
