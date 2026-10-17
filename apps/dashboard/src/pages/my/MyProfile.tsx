import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CameraIcon as Camera, LoaderIcon as Loader2, TrashBinTrashIcon as Trash2 } from '@solar-icons/react/linear';
import { useRef } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { BrandingPanel } from '../../components/BrandingPanel';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Field } from '../../components/Field';
import { initial, PageHeader } from '../../components/PageHeader';
import { useMyScope, useMyVendor } from '../../layouts/VendorLayout';
import { errorMessage, vendorApi, type Vendor } from '../../lib/api';
import { IMAGE_ACCEPT, ImagesTab } from '../vendor/ImagesTab';
import { t } from '../../i18n';
import { StorefrontPreview } from './StorefrontPreview';

/**
 * Vendor admin: Storefront, in two tabs. Storefront (first) previews the shop page in a phone;
 * Branding (?tab=branding) is everything that shapes it, in one section: name, contact email, logo,
 * category, banner and menu pages. Status and currency stay with dvote (currency isn't shown).
 */
export function MyProfile() {
  const vendor = useMyVendor();
  const scope = useMyScope();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'branding' ? 'branding' : 'preview';
  const go = (v: string) => setParams(v === 'branding' ? { tab: v } : {}, { replace: true });
  const fileInput = useRef<HTMLInputElement>(null);
  const done = (v: Vendor, text: string) => {
    qc.setQueryData(['vendor', 'me'], v);
    toast.success(text);
  };

  const logo = useMutation({
    mutationFn: vendorApi.uploadLogo,
    onSuccess: (v) => done(v, t('profile.logoUpdated')),
    onError: (e) => void toast.error(errorMessage(e)),
  });
  const removeLogo = useMutation({
    mutationFn: vendorApi.removeLogo,
    onSuccess: (v) => done(v, t('profile.logoRemoved')),
    onError: (e) => void toast.error(errorMessage(e)),
  });
  const save = useMutation({
    mutationFn: vendorApi.updateProfile,
    onSuccess: (v) => done(v, t('common.saved')),
  });

  return (
    <>
      <PageHeader title={t('nav.profile')} subtitle={t('profile.subtitle')} />
      <Tabs value={tab} onValueChange={go}>
        <TabsList className="mb-4">
          <TabsTrigger value="preview">{t('profile.tabPreview')}</TabsTrigger>
          <TabsTrigger value="branding">{t('profile.tabBranding')}</TabsTrigger>
        </TabsList>
        <TabsContent value="preview">
          <StorefrontPreview onEdit={() => go('branding')} />
        </TabsContent>
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.branding')}</CardTitle>
              <CardDescription>{t('profile.brandingHint')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-8">
              <div className="flex max-w-3xl flex-wrap gap-8">
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    className="relative rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    title={t('profile.uploadLogo')}
                    onClick={() => fileInput.current?.click()}
                  >
                    <Avatar className="size-26">
                      {vendor.logoUrl ? <AvatarImage src={vendor.logoUrl} alt="" /> : null}
                      <AvatarFallback className="bg-brand-soft text-4xl font-semibold text-accent-foreground">{initial(vendor.name)}</AvatarFallback>
                    </Avatar>
                    <span className="absolute -end-0.5 -bottom-0.5 flex size-8 items-center justify-center rounded-full border-2 border-background bg-card">
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
                      <Trash2 /> {t('common.remove')}
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
                  <Field label={t('profile.name')} htmlFor="profile-name">
                    <Input id="profile-name" name="name" required maxLength={120} pattern=".*\S.*" defaultValue={vendor.name} />
                  </Field>
                  <Field label={t('profile.email')} htmlFor="profile-email">
                    <Input id="profile-email" name="contactEmail" type="email" defaultValue={vendor.contactEmail ?? ''} placeholder="hello@shop.com" />
                  </Field>
                  <ErrorAlert error={save.error} />
                  <div>
                    <Button type="submit" disabled={save.isPending}>
                      {save.isPending ? <Loader2 className="animate-spin" /> : null}
                      {t('common.save')}
                    </Button>
                  </div>
                </form>
              </div>
              <Separator />
              <BrandingPanel
                vendor={vendor}
                canEdit
                save={vendorApi.updateProfile}
                uploadBanner={vendorApi.uploadBanner}
                removeBanner={vendorApi.removeBanner}
                onSaved={(v) => qc.setQueryData(['vendor', 'me'], v)}
                showDesign={false}
              />
              <Separator />
              <ImagesTab scope={scope} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
