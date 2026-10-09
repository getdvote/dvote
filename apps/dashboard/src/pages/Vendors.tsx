import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Loader2, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ErrorAlert } from '../components/ErrorAlert';
import { Field } from '../components/Field';
import { Pager, SearchInput, StatusFilter } from '../components/ListControls';
import { initial, PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { TableState } from '../components/TableState';
import { api, type Vendor, type VendorCategory, type VendorStatus } from '../lib/api';
import { categoryLabel, VENDOR_CATEGORIES } from '../lib/cardDesigns';

export const CURRENCIES = ['EGP', 'SAR', 'AED', 'USD', 'EUR'];
const PAGE_SIZE = 20;

/** Every vendor (brand) on dvote: search, filter by status, create a new one. */
export function Vendors() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<VendorStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['vendors', search.trim(), status],
    queryFn: () => api.vendors({ search: search.trim() || undefined, status: status === 'all' ? undefined : status }),
  });
  const rows = (data ?? []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Vendors"
        subtitle="Coffee shop brands on dvote"
        extra={
          <Button size="lg" onClick={() => setCreating(true)}>
            <Plus /> New vendor
          </Button>
        }
      />
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap gap-3 p-4">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search by name"
          />
          <StatusFilter
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[
              { label: 'All', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Suspended', value: 'suspended' },
            ]}
          />
        </div>
        <ErrorAlert error={error} className="mx-4 mb-4 w-auto" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Vendor</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Branches</TableHead>
              <TableHead className="text-right">Staff</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead className="pr-4">Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableState loading={isLoading} empty={rows.length === 0} colSpan={7} emptyText="No vendors found" />
            {rows.map((v) => (
              <TableRow key={v.id} className="cursor-pointer" onClick={() => navigate(`/vendors/${v.id}`)}>
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10">
                      <AvatarImage src={v.logoUrl ?? undefined} alt="" />
                      <AvatarFallback className="bg-brand-soft font-semibold text-accent-foreground">{initial(v.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold">{v.name}</div>
                      <div className="text-xs text-muted-foreground">{v.contactEmail ?? 'No contact email'}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{categoryLabel(v.category) ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  <StatusTag status={v.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{v.branchCount}</TableCell>
                <TableCell className="text-right tabular-nums">{v.staffCount}</TableCell>
                <TableCell>{v.currency}</TableCell>
                <TableCell className="pr-4">{dayjs(v.createdAt).format('D MMM YYYY')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pager page={page} pageSize={PAGE_SIZE} total={data?.length ?? 0} onChange={setPage} />
      </Card>
      <CreateVendorDialog open={creating} onClose={() => setCreating(false)} onCreated={(v) => navigate(`/vendors/${v.id}`)} />
    </>
  );
}

/** Currency picker shared by the create and edit dialogs (posted as `currency`). */
export function CurrencySelect({ id, defaultValue }: { id: string; defaultValue: string }) {
  return (
    <Select name="currency" defaultValue={defaultValue}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CreateVendorDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (v: Vendor) => void }) {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (v: { name: string; contactEmail?: string; currency: string; category?: VendorCategory }) => api.createVendor(v),
    onSuccess: (v) => {
      void qc.invalidateQueries({ queryKey: ['vendors'] });
      toast.success(`${v.name} created`);
      onClose();
      onCreated(v);
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          create.reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New vendor</DialogTitle>
          <DialogDescription>Next, on the vendor page: add branches, a points rule and rewards, then invite the owner.</DialogDescription>
        </DialogHeader>
        <form
          id="create-vendor"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            create.mutate({
              name: String(f.get('name')).trim(),
              contactEmail: String(f.get('contactEmail')).trim() || undefined,
              currency: String(f.get('currency')),
              category: (String(f.get('category') ?? '') || undefined) as VendorCategory | undefined,
            });
          }}
        >
          <Field label="Brand name" htmlFor="vendor-name">
            <Input id="vendor-name" name="name" required maxLength={120} pattern=".*\S.*" placeholder="e.g. Joy Corner" autoFocus />
          </Field>
          <Field label="Contact email" htmlFor="vendor-email">
            <Input id="vendor-email" name="contactEmail" type="email" placeholder="owner@shop.com (optional)" />
          </Field>
          <Field label="Currency" htmlFor="vendor-currency" hint="Locked once the vendor has a points rule.">
            <CurrencySelect id="vendor-currency" defaultValue="EGP" />
          </Field>
          <Field label="Category" htmlFor="vendor-category" hint="Card design and banner are set later, on the vendor's Branding tab.">
            <Select name="category">
              <SelectTrigger id="vendor-category" className="w-full">
                <SelectValue placeholder="Choose (optional)" />
              </SelectTrigger>
              <SelectContent>
                {VENDOR_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <ErrorAlert error={create.error} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-vendor" disabled={create.isPending}>
            {create.isPending ? <Loader2 className="animate-spin" /> : null}
            Create vendor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
