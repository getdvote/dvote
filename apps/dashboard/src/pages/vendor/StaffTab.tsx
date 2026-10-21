import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { CheckCircleIcon as Check, CloseCircleIcon as Cross, LoaderIcon as Loader2, LetterIcon as Mail, UserPlusIcon as UserPlus } from '@solar-icons/react/linear';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Field } from '../../components/Field';
import { StatusTag } from '../../components/StatusTag';
import { TableState } from '../../components/TableState';
import { errorMessage, type Branch, type Staff, type StaffRole } from '../../lib/api';
import { MERCHANT_WIDE, PERMISSION_GROUPS, ROLE_PERMISSIONS } from '../../lib/permissions';
import type { VendorScope } from '../../lib/scope';
import { TabToolbar } from './TabToolbar';
import { t } from '../../i18n';

const ROLE: Record<StaffRole, 'brand' | 'secondary' | 'outline' | 'muted'> = {
  vendor_admin: 'brand',
  branch_manager: 'secondary',
  staff: 'outline',
  viewer: 'muted',
};
const roleLabel = (r: StaffRole) => t(`staff.roles.${r}`);

/** Everyone working at the vendor. The platform invites the vendor admin; they invite the rest. */
export function StaffTab({ scope, selfId }: { scope: VendorScope; selfId?: string }) {
  const qc = useQueryClient();
  const [inviting, setInviting] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ['staff', scope.key], queryFn: () => scope.staff() });
  const { data: branches } = useQuery({ queryKey: ['branches', scope.key], queryFn: () => scope.branches() });
  const branchName = (id: string | null) => (id ? (branches?.find((b) => b.id === id)?.name ?? '—') : t('common.allBranches'));
  const firstStaff = scope.key !== 'me' && data?.length === 0;
  const hasAdmin = data?.some(s => s.role === 'vendor_admin') ?? false;
  const inviteRoles: StaffRole[] = firstStaff ? ['vendor_admin'] : scope.can.inviteRoles.filter(role => role !== 'vendor_admin' || !hasAdmin);
  const onlyAdmins = inviteRoles.length === 1 && inviteRoles[0] === 'vendor_admin';

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
          <Button onClick={() => setInviting(true)} disabled={!data || isLoading}>
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
            <TableState loading={isLoading} empty={!data?.length} colSpan={6} illustration="welcome" emptyTitle={t('emptyStates.staffTitle')}
              emptyText={t('emptyStates.staffText')}
              action={
                scope.can.inviteRoles.length ? (
                  <Button size="sm" onClick={() => setInviting(true)}>
                    <UserPlus /> {onlyAdmins ? t('staff.inviteAdmin') : t('staff.invite')}
                  </Button>
                ) : null
              }
            />
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
        key={`${scope.key}:${firstStaff ? 'first' : 'team'}:${inviting}`}
        scope={scope}
        roles={inviteRoles}
        branches={(branches ?? []).filter((b) => b.status === 'active')}
        open={inviting}
        onClose={() => setInviting(false)}
      />
    </>
  );
}

function InviteDialog({ scope, roles, branches, open, onClose }: { scope: VendorScope; roles: StaffRole[]; branches: Branch[]; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [role, setRole] = useState<StaffRole>(roles[0]);
  const [branchId, setBranchId] = useState<string | undefined>();
  const wide = MERCHANT_WIDE.includes(role);
  const pickBranch = !wide && !scope.can.fixedBranchId;

  const invite = useMutation({
    mutationFn: async (v: { name: string; email: string }) => {
      if (pickBranch && !branchId) throw new Error(t('staff.chooseBranchError'));
      return scope.inviteStaff({
        ...v,
        role,
        branchId: wide ? undefined : (scope.can.fixedBranchId ?? branchId),
      });
    },
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: ['staff', scope.key] });
      void qc.invalidateQueries({ queryKey: ['vendor', scope.key] });
      toast.success(s.invited ? t('staff.invitedToast', { email: s.email }) : t('staff.linkedToast', { email: s.email }));
      onClose();
    },
  });
  const close = (o: boolean) => {
    if (!o) {
      onClose();
      invite.reset();
    }
  };
  const title = role === 'vendor_admin' && roles.length === 1 ? t('staff.inviteAdmin') : t('staff.invite');
  const form = (
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
      {roles.length === 1 && role === 'vendor_admin' ? <p className="rounded-lg border bg-muted p-3 text-sm">{t('staff.firstAdmin')}</p> : null}
      {roles.length > 1 ? (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">{t('staff.role')}</legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
            {roles.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={r === role}
                onClick={() => setRole(r)}
                className={cn(
                  'grid gap-0.5 rounded-xl border p-3 text-start outline-none transition duration-100 ease-linear focus-visible:ring-3 focus-visible:ring-ring/50',
                  r === role ? 'border-primary bg-brand-soft ring-1 ring-primary' : 'hover:bg-muted',
                )}
              >
                <span className="text-sm font-medium">{roleLabel(r)}</span>
                <span className="text-xs text-muted-foreground">{t(`staff.roleText.${r}`)}</span>
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
      {/* the branch comes right after the role it belongs to, before that role's permissions */}
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
      {roles.length > 1 ? <RolePermissions role={role} /> : null}
      <ErrorAlert error={invite.error} />
    </form>
  );
  const actions = (
    <>
      <Button variant="outline" onClick={onClose}>
        {t('common.cancel')}
      </Button>
      <Button type="submit" form="invite-form" disabled={invite.isPending}>
        {invite.isPending ? <Loader2 className="animate-spin" /> : null}
        {t('staff.send')}
      </Button>
    </>
  );

  // With roles to choose (and their permissions to read), a drawer; a single role fits a dialog.
  if (roles.length > 1) {
    return (
      <Sheet open={open} onOpenChange={close}>
        <SheetContent className="gap-0 data-[side=left]:w-full data-[side=right]:w-full data-[side=left]:sm:max-w-xl data-[side=right]:sm:max-w-xl">
          <SheetHeader className="border-b pe-12">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{t('staff.inviteText')}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{form}</div>
          <SheetFooter className="flex-row justify-end border-t">{actions}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t('staff.inviteText')}</DialogDescription>
        </DialogHeader>
        {form}
        <DialogFooter>{actions}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The fixed bundle a role comes with, grouped like the dashboard (read-only). */
export function RolePermissions({ role }: { role: StaffRole }) {
  const has = ROLE_PERMISSIONS[role];
  return (
    <div className="mt-2 grid gap-4 rounded-xl border p-4">
      <div>
        <h3 className="text-sm font-medium">{t('staff.permissionsTitle', { role: roleLabel(role) })}</h3>
        {role === 'branch_manager' || role === 'staff' ? (
          <p className="text-xs text-muted-foreground">{t('staff.branchOnly')}</p>
        ) : null}
      </div>
      <div className="grid gap-4">
        {PERMISSION_GROUPS.map((g) => (
          <section key={g.key} className="grid content-start gap-2">
            <h4 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{t(`staff.permGroups.${g.key}`)}</h4>
            <ul className="grid gap-2">
              {g.items.map((i) => {
                const on = has.includes(i.key);
                return (
                  <li key={i.key} className={cn('flex items-start gap-2', !on && 'opacity-60')}>
                    {on ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-label={t('common.yes')} />
                    ) : (
                      <Cross className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label={t('common.no')} />
                    )}
                    <span className="min-w-0 text-sm">
                      <span className="font-medium">{t(`staff.perms.${i.key}.label`)}</span>
                      {'soon' in i && i.soon ? (
                        <Badge variant="outline" className="ms-1.5 align-middle">
                          {t('staff.soon')}
                        </Badge>
                      ) : null}
                      <span className="block text-xs text-muted-foreground">{t(`staff.perms.${i.key}.hint`)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
