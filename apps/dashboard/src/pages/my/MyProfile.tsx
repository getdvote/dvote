import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CameraIcon as Camera,
  CheckCircleIcon as CheckCircle,
  GalleryAddIcon as ImagePlus,
  LoaderIcon as Loader2,
  PaletteIcon as Palette,
  TrashBinTrashIcon as Trash2,
  UploadMinimalisticIcon as Upload,
} from '@solar-icons/react/linear';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Field } from '../../components/Field';
import { initial, PageHeader } from '../../components/PageHeader';
import { useMyScope, useMyVendor } from '../../layouts/VendorLayout';
import { errorMessage, vendorApi, type Vendor, type VendorCategory } from '../../lib/api';
import { categoryLabel, VENDOR_CATEGORIES } from '../../lib/cardDesigns';
import { COVER_SHADERS, defaultShader, renderShader, shaderCss, type CoverShader } from '../../lib/coverShaders';
import { formatEgyptianMobile, toEgyptianMobile } from '../../lib/phone';
import { cn } from '@/lib/utils';
import { IMAGE_ACCEPT, ImagesTab } from '../vendor/ImagesTab';
import { t } from '../../i18n';
import { StorefrontPreview } from './StorefrontPreview';

const NONE = 'none';

/**
 * Vendor admin: Storefront = the shop page in a phone, with the menu pages beside it. The shop's
 * branding (logo, cover, name, category, contact) is edited in Settings → Branding.
 */
export function MyProfile() {
  const scope = useMyScope();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // old links to the Branding tab that used to be here
  if (params.get('tab') === 'branding') return <Navigate to="/settings?tab=branding" replace />;

  return (
    <>
      <PageHeader title={t('nav.profile')} subtitle={t('profile.subtitle')} />
      <div className="grid items-start gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
        <StorefrontPreview onEdit={() => navigate('/settings?tab=branding')} />
        <Card>
          <CardContent>
            <ImagesTab scope={scope} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/** The shop profile (Settings → Branding): cover (banner) + logo on top, the details form below. */
export function ProfileEditor() {
  const vendor = useMyVendor();
  const qc = useQueryClient();
  const logoInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);
  const done = (text: string) => (v: Vendor) => {
    qc.setQueryData(['vendor', 'me'], v);
    toast.success(text);
  };
  const fail = (e: unknown) => void toast.error(errorMessage(e));

  const logo = useMutation({ mutationFn: vendorApi.uploadLogo, onSuccess: done(t('profile.logoUpdated')), onError: fail });
  const removeLogo = useMutation({ mutationFn: vendorApi.removeLogo, onSuccess: done(t('profile.logoRemoved')), onError: fail });
  const banner = useMutation({ mutationFn: vendorApi.uploadBanner, onSuccess: done(t('branding.bannerSaved')), onError: fail });
  const removeBanner = useMutation({ mutationFn: vendorApi.removeBanner, onSuccess: done(t('branding.bannerRemoved')), onError: fail });

  const [templatesOpen, setTemplatesOpen] = useState(false);
  const coverBusy = banner.isPending || removeBanner.isPending;
  const category = categoryLabel(vendor.category);

  return (
    <Card className="gap-0 overflow-hidden pt-0">
      {/* Cover = the shop-page banner */}
      <div
        className="relative aspect-[2/1] max-h-64 w-full sm:aspect-[4/1]"
        style={vendor.bannerUrl ? undefined : { background: shaderCss(defaultShader(vendor.id)) }}
      >
        {vendor.bannerUrl ? <img src={vendor.bannerUrl} alt="" className="size-full object-cover" /> : null}
        {coverBusy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Loader2 className="size-6 animate-spin text-white" />
          </div>
        ) : null}
        <div className="absolute end-3 top-3 flex gap-2">
          {vendor.bannerUrl ? (
            <Button size="sm" variant="secondary" disabled={coverBusy} aria-label={t('common.remove')} onClick={() => removeBanner.mutate()}>
              <Trash2 />
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="secondary" disabled={coverBusy}>
                <ImagePlus /> {vendor.bannerUrl ? t('profile.changeCover') : t('profile.addCover')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => bannerInput.current?.click()}>
                <Upload /> {t('profile.coverUpload')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTemplatesOpen(true)}>
                <Palette /> {t('profile.coverTemplates')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <input
          ref={bannerInput}
          type="file"
          accept={IMAGE_ACCEPT}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) banner.mutate(f);
            e.target.value = '';
          }}
        />
      </div>
      <CoverTemplates
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        initial={vendor.bannerUrl ? null : defaultShader(vendor.id).id}
        pending={banner.isPending}
        onPick={(file) => banner.mutate(file, { onSuccess: () => setTemplatesOpen(false) })}
      />

      {/* Logo over the cover, name + category beside it */}
      <div className="flex flex-wrap items-end gap-4 px-6">
        <div className="-mt-12 shrink-0">
          <button
            type="button"
            className="relative rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            title={t('profile.uploadLogo')}
            onClick={() => logoInput.current?.click()}
          >
            <Avatar className="size-24 border-4 border-card bg-card shadow-sm">
              {vendor.logoUrl ? <AvatarImage src={vendor.logoUrl} alt="" /> : null}
              <AvatarFallback className="bg-brand-soft text-3xl font-semibold text-accent-foreground">{initial(vendor.name)}</AvatarFallback>
            </Avatar>
            <span className="absolute end-0 bottom-0 flex size-8 items-center justify-center rounded-full border-2 border-card bg-card shadow-xs">
              {logo.isPending ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            </span>
          </button>
          <input
            ref={logoInput}
            type="file"
            accept={IMAGE_ACCEPT}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) logo.mutate(f);
              e.target.value = '';
            }}
          />
        </div>
        <div className="min-w-0 flex-1 pt-3">
          <h2 className="truncate text-lg font-semibold">{vendor.name}</h2>
          <p className="text-sm text-muted-foreground">{category ?? t('profile.noCategory')}</p>
        </div>
        {vendor.logoUrl ? (
          <Button size="sm" variant="ghost" className="text-destructive" disabled={removeLogo.isPending} onClick={() => removeLogo.mutate()}>
            <Trash2 /> {t('profile.removeLogo')}
          </Button>
        ) : null}
      </div>
      <p className="px-6 pt-3 text-xs text-muted-foreground">{t('branding.bannerHint')}</p>

      <Separator className="mt-6" />

      <CardHeader className="pt-6">
        <CardTitle>{t('profile.details')}</CardTitle>
        <CardDescription>{t('profile.detailsHint')}</CardDescription>
        <CardAction>
          <SaveStatus />
        </CardAction>
      </CardHeader>
      <CardContent className="pt-6">
        <DetailsForm vendor={vendor} />
      </CardContent>
    </Card>
  );
}

const AUTOSAVE = ['vendor-profile', 'autosave'];
const AUTOSAVE_DELAY = 800; // ms after the last keystroke

type Details = { name: string; contactEmail: string | null; contactPhone: string | null; category: VendorCategory | null };
type DetailField = keyof Details;

/** "Saving…" while an autosave runs, then "All changes saved". */
function SaveStatus() {
  const saving = useIsMutating({ mutationKey: AUTOSAVE }) > 0;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
      {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle className="size-3.5" />}
      {saving ? t('profile.saving') : t('profile.allSaved')}
    </span>
  );
}

/**
 * Name, category, contact email and phone, saved on their own: the category as soon as it is
 * picked, text fields shortly after typing stops (or when leaving the field), each field alone
 * and only when it changed and is valid.
 */
function DetailsForm({ vendor }: { vendor: Vendor }) {
  const qc = useQueryClient();
  const [category, setCategory] = useState<string>(vendor.category ?? NONE);
  const [phoneError, setPhoneError] = useState(false);
  const saved = useRef<Details>({
    name: vendor.name,
    contactEmail: vendor.contactEmail,
    contactPhone: vendor.contactPhone,
    category: vendor.category,
  });

  const save = useMutation({
    mutationKey: AUTOSAVE,
    mutationFn: vendorApi.updateProfile,
    onSuccess: (v, body) => {
      saved.current = { ...saved.current, ...body };
      qc.setQueryData(['vendor', 'me'], v);
    },
    onError: (e) => void toast.error(errorMessage(e)),
  });

  const commit = <K extends DetailField>(field: K, value: Details[K]) => {
    if (saved.current[field] === value) return;
    save.mutate({ [field]: value } as Partial<Details>);
  };

  // One waiting save per field: typing restarts it, leaving the field (or the page) runs it now.
  const waiting = useRef<Partial<Record<DetailField, { timer: number; run: () => void }>>>({});
  const schedule = (field: DetailField, run: () => void) => {
    window.clearTimeout(waiting.current[field]?.timer);
    const timer = window.setTimeout(() => now(field, run), AUTOSAVE_DELAY);
    waiting.current[field] = { timer, run };
  };
  const now = (field: DetailField, run: () => void) => {
    window.clearTimeout(waiting.current[field]?.timer);
    delete waiting.current[field];
    run();
  };
  useEffect(
    () => () => Object.values(waiting.current).forEach((w) => {
      window.clearTimeout(w.timer);
      w.run();
    }),
    [],
  );

  const saveName = (input: HTMLInputElement) => () => {
    const v = input.value.trim();
    if (v) commit('name', v);
  };
  const saveEmail = (input: HTMLInputElement) => () => {
    if (input.checkValidity()) commit('contactEmail', input.value.trim() || null);
  };
  const savePhone = (input: HTMLInputElement, onLeave: boolean) => () => {
    const raw = input.value.trim();
    const phone = raw ? toEgyptianMobile(raw) : null;
    if (raw && !phone) {
      if (onLeave) setPhoneError(true);
      return;
    }
    if (onLeave) input.value = formatEgyptianMobile(phone);
    commit('contactPhone', phone);
  };

  return (
    <form className="grid gap-5 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
      <Field label={t('profile.name')} htmlFor="profile-name">
        <Input
          id="profile-name"
          name="name"
          required
          maxLength={120}
          pattern=".*\S.*"
          defaultValue={vendor.name}
          onChange={(e) => schedule('name', saveName(e.currentTarget))}
          onBlur={(e) => now('name', saveName(e.currentTarget))}
        />
      </Field>
      <Field label={t('branding.category')} htmlFor="profile-category" hint={t('branding.categoryHint')}>
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v);
            commit('category', v === NONE ? null : (v as VendorCategory));
          }}
        >
          <SelectTrigger id="profile-category" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t('branches.notSet')}</SelectItem>
            {VENDOR_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {categoryLabel(c.value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t('profile.email')} htmlFor="profile-email">
        <Input
          id="profile-email"
          name="contactEmail"
          type="email"
          maxLength={255}
          defaultValue={vendor.contactEmail ?? ''}
          placeholder="hello@shop.com"
          onChange={(e) => schedule('contactEmail', saveEmail(e.currentTarget))}
          onBlur={(e) => now('contactEmail', saveEmail(e.currentTarget))}
        />
      </Field>
      <Field
        label={t('profile.phone')}
        htmlFor="profile-phone"
        hint={phoneError ? <span className="text-destructive">{t('profile.phoneInvalid')}</span> : undefined}
      >
        <Input
          id="profile-phone"
          name="contactPhone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel-national"
          maxLength={20}
          aria-invalid={phoneError || undefined}
          defaultValue={formatEgyptianMobile(vendor.contactPhone)}
          placeholder="010 1234 5678"
          onChange={(e) => {
            if (phoneError) setPhoneError(false);
            schedule('contactPhone', savePhone(e.currentTarget, false));
          }}
          onBlur={(e) => now('contactPhone', savePhone(e.currentTarget, true))}
        />
      </Field>
    </form>
  );
}

/** Pick one of the 10 gradient covers; it is drawn as a 1600 × 800 image and saved as the banner. */
function CoverTemplates({
  open,
  onOpenChange,
  initial,
  pending,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected template (the default cover when there is no banner). */
  initial: string | null;
  pending: boolean;
  onPick: (file: File) => void;
}) {
  const [selected, setSelected] = useState<string | null>(initial);
  const [drawing, setDrawing] = useState(false);
  const busy = drawing || pending;
  const use = async (s: CoverShader) => {
    setDrawing(true);
    try {
      onPick(await renderShader(s));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDrawing(false);
    }
  };
  const chosen = COVER_SHADERS.find((s) => s.id === selected);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setSelected(initial);
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('profile.templatesTitle')}</DialogTitle>
          <DialogDescription>{t('profile.templatesHint')}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {COVER_SHADERS.map((s) => {
            const on = s.id === selected;
            return (
              <button
                key={s.id}
                type="button"
                disabled={busy}
                aria-pressed={on}
                onClick={() => setSelected(s.id)}
                className={cn(
                  'grid gap-1.5 rounded-xl p-1 text-start outline-none transition duration-100 ease-linear focus-visible:ring-3 focus-visible:ring-ring/50',
                  on ? 'bg-brand-soft ring-2 ring-primary' : 'enabled:hover:bg-muted',
                )}
              >
                <span className="relative block aspect-[2/1] w-full rounded-lg" style={{ background: shaderCss(s) }}>
                  {on ? <CheckCircle className="absolute end-1.5 top-1.5 size-5 rounded-full bg-white/90 text-primary" /> : null}
                </span>
                <span className="px-1 text-xs font-medium">{t(`coverShaders.${s.id}` as 'coverShaders.sunset')}</span>
              </button>
            );
          })}
        </div>
        {chosen ? <div className="aspect-[4/1] w-full rounded-xl" style={{ background: shaderCss(chosen) }} aria-hidden /> : null}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!chosen || busy} onClick={() => chosen && void use(chosen)}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {t('profile.useTemplate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
