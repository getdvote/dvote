import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useMe, useMyScope } from '../layouts/VendorLayout';
import { useVendorApi } from '../lib/vendor-workspace';
import { errorMessage, type StaffRole } from '../lib/api';
import { StaffTab } from './vendor/StaffTab';
import { ErrorAlert } from '../components/ErrorAlert';

export function AdminTeam() {
  const scope = useMyScope();
  const me = useMe();
  const client = useVendorApi();
  const cache = useQueryClient();
  const staff = useQuery({
    queryKey: ['staff', scope.key],
    queryFn: client.staff,
  });
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole>('staff');
  const [branch, setBranch] = useState('');
  const wide = role === 'vendor_admin' || role === 'viewer';
  const ownerExists = staff.data?.some((s) => s.role === 'vendor_admin' && s.id !== id);
  const save = useMutation({
    mutationFn: () =>
      client.updateStaff(id, {
        name: name.trim(),
        role,
        ...(wide ? {} : { branchId: branch }),
      }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['staff', scope.key] });
      toast.success('Team member updated');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <StaffTab scope={scope} selfId={me.id} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <h2 className="text-lg font-semibold">Edit team access</h2>
          <p className="text-sm text-muted-foreground">Change a team member’s name, role or branch. Each merchant can have one merchant admin.</p>
          <label className="grid gap-2 text-sm">
            Team member
            <select
              className="h-10 rounded-md border bg-background px-3"
              value={id}
              onChange={(e) => {
                const s = staff.data?.find((s) => s.id === e.target.value);
                setId(e.target.value);
                setName(s?.name ?? '');
                setRole(s?.role ?? 'staff');
                setBranch(s?.branchId ?? '');
              }}
            >
              <option value="">Select a team member</option>
              {staff.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.email}
                </option>
              ))}
            </select>
          </label>
          {id && (
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <label className="grid gap-2 text-sm">
                Name
                <Input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="grid gap-2 text-sm">
                Role
                <select className="h-10 rounded-md border bg-background px-3" value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
                  <option value="vendor_admin" disabled={ownerExists}>
                    Merchant admin{ownerExists ? ' (already assigned)' : ''}
                  </option>
                  <option value="branch_manager">Branch manager</option>
                  <option value="staff">Staff</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>
              {!wide && (
                <label className="grid gap-2 text-sm">
                  Branch
                  <select required className="h-10 rounded-md border bg-background px-3" value={branch} onChange={(e) => setBranch(e.target.value)}>
                    <option value="">Select a branch</option>
                    {me.branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="self-end">
                <Button disabled={save.isPending || !name.trim() || (!wide && !branch)}>Save team member</Button>
              </div>
              <ErrorAlert error={save.error} />
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
