import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BrandingPanel } from '../../components/BrandingPanel';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Field } from '../../components/Field';
import { initial, PageHeader } from '../../components/PageHeader';
import { useMyVendor } from '../../layouts/VendorLayout';
import { errorMessage, vendorApi, type Vendor } from '../../lib/api';
import { IMAGE_ACCEPT } from '../vendor/ImagesTab';

/** Vendor admin: my shop's name, contact email, logo, and branding (category, banner, card design). Status and currency stay with dvote. */
export function MyProfile() {
  const vendor = useMyVendor();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const done = (v: Vendor, text: string) => {
    qc.setQueryData(['vendor', 'me'], v);
    toast.success(text);
  };

  const logo = useMutation({
    mutationFn: vendorApi.uploadLogo,
    onSuccess: (v) => done(v, 'Logo updated'),
    onError: (e) => void toast.error(errorMessage(e)),
  });
  const removeLogo = useMutation({
    mutationFn: vendorApi.removeLogo,
    onSuccess: (v) => done(v, 'Logo removed'),
    onError: (e) => void toast.error(errorMessage(e)),
  });
  const save = useMutation({
    mutationFn: vendorApi.updateProfile,
    onSuccess: (v) => done(v, 'Saved'),
  });

  return (
    <>
      <PageHeader title="Shop profile" subtitle="How your shop appears in the dvote app." />
      <Card className="max-w-3xl">
        <CardContent className="flex flex-wrap gap-8">
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              className="relative rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              title="Upload logo"
              onClick={() => fileInput.current?.click()}
            >
              <Avatar className="size-26">
                {vendor.logoUrl ? <AvatarImage src={vendor.logoUrl} alt="" /> : null}
                <AvatarFallback className="bg-brand-soft text-4xl font-semibold text-accent-foreground">{initial(vendor.name)}</AvatarFallback>
              </Avatar>
              <span className="absolute -right-0.5 -bottom-0.5 flex size-8 items-center justify-center rounded-full border-2 border-background bg-card">
                {logo.isPending ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              </span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept={IMAGE_ACCEPT}
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) logo.mutate(f);
                e.target.value = '';
              }}
            />
            {vendor.logoUrl ? (
              <Button size="sm" variant="ghost" className="text-destructive" disabled={removeLogo.isPending} onClick={() => removeLogo.mutate()}>
                <Trash2 /> Remove
              </Button>
            ) : null}
          </div>

          <form
            key={vendor.updatedAt}
            className="grid min-w-64 flex-1 gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              save.mutate({ name: String(f.get('name')).trim(), contactEmail: String(f.get('contactEmail')).trim() || null });
            }}
          >
            <Field label="Shop name" htmlFor="profile-name">
              <Input id="profile-name" name="name" required maxLength={120} pattern=".*\S.*" defaultValue={vendor.name} />
            </Field>
            <Field label="Contact email" htmlFor="profile-email">
              <Input id="profile-email" name="contactEmail" type="email" defaultValue={vendor.contactEmail ?? ''} placeholder="hello@shop.com" />
            </Field>
            <Field label="Currency" htmlFor="profile-currency" hint="Set by dvote. Contact support to change it.">
              <Input id="profile-currency" value={vendor.currency} disabled />
            </Field>
            <ErrorAlert error={save.error} />
            <div>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? <Loader2 className="animate-spin" /> : null}
                Save
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Branding</CardTitle>
        </CardHeader>
        <CardContent>
          <BrandingPanel
            vendor={vendor}
            canEdit
            save={vendorApi.updateProfile}
            uploadBanner={vendorApi.uploadBanner}
            removeBanner={vendorApi.removeBanner}
            onSaved={(v) => qc.setQueryData(['vendor', 'me'], v)}
          />
        </CardContent>
      </Card>
    </>
  );
}
