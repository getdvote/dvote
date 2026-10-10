import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, Camera, CircleCheck, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmAction } from '../components/ConfirmAction';
import { ErrorAlert } from '../components/ErrorAlert';
import { Field } from '../components/Field';
import { initial } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { api, errorMessage, type Vendor } from '../lib/api';
import { adminScope } from '../lib/scope';
import { BranchesTab } from './vendor/BranchesTab';
import { IMAGE_ACCEPT, ImagesTab } from './vendor/ImagesTab';
import { RewardsTab } from './vendor/RewardsTab';
import { RulesTab } from './vendor/RulesTab';
import { StaffTab } from './vendor/StaffTab';
import { BrandingPanel } from '../components/BrandingPanel';
import { categoryLabel } from '../lib/cardDesigns';
import { CurrencySelect } from './Vendors';

const TAB = 'flex-none px-3 text-[15px] after:bg-primary data-active:text-primary';

/** One vendor: profile, logo, status, and its branches, points rule, rewards, menu, staff and branding. */
export function VendorDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: vendor, isLoading, error } = useQuery({ queryKey: ['vendor', id], queryFn: () => api.vendor(id) });

  return (
    <>
      <Button variant="ghost" className="mb-3 -ml-2.5 text-muted-foreground" onClick={() => navigate('/merchants')}>
        <ArrowLeft /> All merchants
      </Button>
      <ErrorAlert error={error} />
      {isLoading || !vendor ? (
        error ? null : (
          <div className="grid gap-5">
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        )
      ) : (
        <div className="grid gap-5">
          <VendorHeader vendor={vendor} />
          <Card>
            <CardContent>
              <Tabs defaultValue="branches">
                <TabsList variant="line" className="mb-4 w-full justify-start overflow-x-auto">
                  <TabsTrigger value="branches" className={TAB}>Branches</TabsTrigger>
                  <TabsTrigger value="rule" className={TAB}>Points rule</TabsTrigger>
                  <TabsTrigger value="rewards" className={TAB}>Rewards</TabsTrigger>
                  <TabsTrigger value="images" className={TAB}>Menu</TabsTrigger>
                  <TabsTrigger value="staff" className={TAB}>Staff</TabsTrigger>
                  <TabsTrigger value="branding" className={TAB}>Branding</TabsTrigger>
                </TabsList>
                <TabsContent value="branches">
                  <BranchesTab scope={adminScope(vendor.id, vendor.currency)} />
                </TabsContent>
                <TabsContent value="rule">
                  <RulesTab scope={adminScope(vendor.id, vendor.currency)} />
                </TabsContent>
                <TabsContent value="rewards">
                  <RewardsTab scope={adminScope(vendor.id, vendor.currency)} />
                </TabsContent>
                <TabsContent value="images">
                  <ImagesTab scope={adminScope(vendor.id, vendor.currency)} />
                </TabsContent>
                <TabsContent value="staff">
                  <StaffTab scope={adminScope(vendor.id, vendor.currency)} />
                </TabsContent>
                <TabsContent value="branding">
                  <BrandingPanel
                    vendor={vendor}
                    canEdit
                    save={(body) => api.updateVendor(vendor.id, body)}
                    uploadBanner={(f) => api.uploadBanner(vendor.id, f)}
                    removeBanner={() => api.removeBanner(vendor.id)}
                    onSaved={(v) => {
                      qc.setQueryData(['vendor', v.id], v);
                      void qc.invalidateQueries({ queryKey: ['vendors'] });
                    }}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function VendorHeader({ vendor }: { vendor: Vendor }) {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const refresh = (v: Vendor) => {
    qc.setQueryData(['vendor', v.id], v);
    void qc.invalidateQueries({ queryKey: ['vendors'] });
  };

  const logo = useMutation({
    mutationFn: (file: File) => api.uploadLogo(vendor.id, file),
    onSuccess: (v) => {
      refresh(v);
      toast.success('Logo updated');
    },
    onError: (e) => void toast.error(errorMessage(e)),
  });
  const removeLogo = useMutation({
    mutationFn: () => api.removeLogo(vendor.id),
    onSuccess: (v) => {
      refresh(v);
      toast.success('Logo removed');
    },
    onError: (e) => void toast.error(errorMessage(e)),
  });
  const setStatus = useMutation({
    mutationFn: (status: Vendor['status']) => api.updateVendor(vendor.id, { status }),
    onSuccess: (v) => {
      refresh(v);
      toast.success(v.status === 'active' ? `${v.name} is active` : `${v.name} is suspended`);
    },
    onError: (e) => void toast.error(errorMessage(e)),
  });

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-6">
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            className="relative rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            title="Upload logo"
            aria-label="Upload logo"
            disabled={logo.isPending}
            onClick={() => fileInput.current?.click()}
          >
            <Avatar className="size-22">
              <AvatarImage src={vendor.logoUrl ?? undefined} alt="" />
              <AvatarFallback className="bg-brand-soft text-3xl font-semibold text-accent-foreground">{initial(vendor.name)}</AvatarFallback>
            </Avatar>
            <span className="absolute -right-0.5 -bottom-0.5 flex size-8 items-center justify-center rounded-full border-2 border-background bg-card text-foreground shadow-sm">
              {logo.isPending ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            </span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept={IMAGE_ACCEPT}
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) logo.mutate(file);
              e.target.value = '';
            }}
          />
          {vendor.logoUrl ? (
            <Button variant="link" size="sm" className="text-destructive" disabled={removeLogo.isPending} onClick={() => removeLogo.mutate()}>
              <Trash2 /> Remove
            </Button>
          ) : null}
        </div>

        <div className="min-w-56 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">{vendor.name}</h1>
            <StatusTag status={vendor.status} />
          </div>
          <p className="mt-1 text-muted-foreground">
            {categoryLabel(vendor.category) ?? 'No category'} · {vendor.contactEmail ?? 'No contact email'} · {vendor.currency} · {vendor.branchCount} branches · {vendor.staffCount} staff
          </p>
          {logo.isPending ? <p className="mt-1 text-sm text-muted-foreground">Uploading logo…</p> : null}
        </div>

        <div className="flex gap-2.5">
          <Button variant="outline" size="lg" onClick={() => setEditing(true)}>
            <Pencil /> Edit
          </Button>
          {vendor.status === 'suspended' ? (
            <Button size="lg" disabled={setStatus.isPending} onClick={() => setStatus.mutate('active')}>
              {setStatus.isPending ? <Loader2 className="animate-spin" /> : <CircleCheck />} Activate
            </Button>
          ) : (
            <ConfirmAction
              title={`Suspend ${vendor.name}?`}
              description="Customers stop seeing it, its staff can no longer sign in, and no points can be collected there. Nothing is deleted; you can activate it again any time."
              actionLabel="Suspend"
              onConfirm={() => setStatus.mutateAsync('suspended')}
              trigger={
                <Button variant="destructive" size="lg">
                  <Ban /> Suspend
                </Button>
              }
            />
          )}
        </div>
      </CardContent>
      <EditVendorDialog vendor={vendor} open={editing} onClose={() => setEditing(false)} onSaved={refresh} />
    </Card>
  );
}

function EditVendorDialog({
  vendor,
  open,
  onClose,
  onSaved,
}: {
  vendor: Vendor;
  open: boolean;
  onClose: () => void;
  onSaved: (v: Vendor) => void;
}) {
  const save = useMutation({
    mutationFn: (v: { name: string; contactEmail: string | null; currency: string }) =>
      api.updateVendor(vendor.id, {
        name: v.name,
        contactEmail: v.contactEmail,
        ...(v.currency !== vendor.currency ? { currency: v.currency } : {}),
      }),
    onSuccess: (v) => {
      onSaved(v);
      toast.success('Saved');
      onClose();
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          save.reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit merchant</DialogTitle>
        </DialogHeader>
        <form
          id="edit-vendor"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({
              name: String(f.get('name')).trim(),
              contactEmail: String(f.get('contactEmail')).trim() || null,
              currency: String(f.get('currency')),
            });
          }}
        >
          <Field label="Brand name" htmlFor="edit-name">
            <Input id="edit-name" name="name" required maxLength={120} pattern=".*\S.*" defaultValue={vendor.name} />
          </Field>
          <Field label="Contact email" htmlFor="edit-email">
            <Input id="edit-email" name="contactEmail" type="email" defaultValue={vendor.contactEmail ?? ''} />
          </Field>
          <Field label="Currency" htmlFor="edit-currency" hint="Can't change once the merchant has a points rule.">
            <CurrencySelect id="edit-currency" defaultValue={vendor.currency} />
          </Field>
          <ErrorAlert error={save.error} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-vendor" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
