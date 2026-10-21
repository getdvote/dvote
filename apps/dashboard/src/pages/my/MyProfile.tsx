import { useVendorApi } from '../../lib/vendor-workspace';
import { useQuery, useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { CameraIcon as Camera, CheckCircleIcon as CheckCircle, LoaderIcon as Loader2, TrashBinTrashIcon as Trash2 } from '@solar-icons/react/linear';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Field } from '../../components/Field';
import { initial, PageHeader } from '../../components/PageHeader';
import { useMyVendor } from '../../layouts/VendorLayout';
import { errorMessage, type Vendor, type VendorCategory } from '../../lib/api';
import { categoryLabel, VENDOR_CATEGORIES } from '../../lib/cardDesigns';
import { formatEgyptianMobile, toEgyptianMobile } from '../../lib/phone';
import { IMAGE_ACCEPT } from '../vendor/ImagesTab';
import { t } from '../../i18n';
import { config } from '../../lib/config';
import { StorefrontEditor } from './storefront-editor';

const NONE = 'none';

/**
 * Vendor admin: Storefront = the customer website page and its sections (storefront-editor.tsx).
 * The shop's look and details (logo, colours, font, page style) are in Settings → Branding.
 */
export function MyProfile() {
  const [params] = useSearchParams();
  // old links to the Branding tab that used to be here
  if (params.get('tab') === 'branding') return <Navigate to={`/settings?${params.toString()}`} replace />;

  return (
    <>
      <PageHeader title={t('nav.profile')} subtitle={t('storefront.subtitle')} />
      <StorefrontEditor />
    </>
  );
}

/** The shop profile (Settings → Branding): cover (banner) + logo on top, the details form below. */
export function ProfileEditor() {
  const vendorApi = useVendorApi();
  const vendor = useMyVendor();
  const qc = useQueryClient();
  const logoInput = useRef<HTMLInputElement>(null);
  const done = (text: string) => (v: Vendor) => {
    qc.setQueryData(['vendor', 'me'], v);
    toast.success(text);
  };
  const fail = (e: unknown) => void toast.error(errorMessage(e));

  const logo = useMutation({
    mutationFn: vendorApi.uploadLogo,
    onSuccess: done(t('profile.logoUpdated')),
    onError: fail,
  });
  const removeLogo = useMutation({
    mutationFn: vendorApi.removeLogo,
    onSuccess: done(t('profile.logoRemoved')),
    onError: fail,
  });
  const category = categoryLabel(vendor.category);

  return (
    <Card className="gap-0">
      {/* Logo, name + category */}
      <div className="flex flex-wrap items-center gap-4 px-6">
        <div className="shrink-0">
          <button
            type="button"
            className="relative rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            title={t('profile.uploadLogo')}
            onClick={() => logoInput.current?.click()}
          >
            <Avatar className="size-20 border bg-card shadow-sm">
              {vendor.logoUrl ? <AvatarImage src={vendor.logoUrl} alt="" /> : null}
              <AvatarFallback className="bg-secondary text-3xl font-semibold text-accent-foreground">{initial(vendor.name)}</AvatarFallback>
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
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{vendor.name}</h2>
          <p className="text-sm text-muted-foreground">{category ?? t('profile.noCategory')}</p>
        </div>
        {vendor.logoUrl ? (
          <Button size="sm" variant="ghost" className="text-destructive" disabled={removeLogo.isPending} onClick={() => removeLogo.mutate()}>
            <Trash2 /> {t('profile.removeLogo')}
          </Button>
        ) : null}
      </div>

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
        <UsernameEditor key={vendor.id} vendor={vendor} />
      </CardContent>
    </Card>
  );
}

const AUTOSAVE = ['vendor-profile', 'autosave'];
const AUTOSAVE_DELAY = 800; // ms after the last keystroke

type Details = {
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  category: VendorCategory | null;
};
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
  const vendorApi = useVendorApi();
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
    () => () =>
      Object.values(waiting.current).forEach((w) => {
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

function UsernameEditor({ vendor }: { vendor: Vendor }) {
  const vendorApi = useVendorApi();
  const qc = useQueryClient();
  const [value, setValue] = useState(vendor.slug);
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value.trim().toLowerCase()), 350);
    return () => clearTimeout(timer);
  }, [value]);
  const username = value.trim().toLowerCase();
  const valid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(username) && username.length >= 2 && username.length <= 50;
  const check = useQuery({
    queryKey: ['username-availability', vendor.id, debounced],
    queryFn: () => vendorApi.usernameAvailability(debounced),
    enabled: valid && debounced === username,
    staleTime: 0,
  });
  const save = useMutation({
    mutationFn: vendorApi.reserveUsername,
    onSuccess: (v) => {
      qc.setQueryData(['vendor', 'me'], v);
      setValue(v.slug);
      toast.success(t('profile.usernameSaved'));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="mt-6 border-t pt-6">
      <Field label={t('profile.username')} htmlFor="storefront-username" hint={t('profile.usernameHint')}>
        <div className="flex flex-wrap gap-2">
          <Input
            id="storefront-username"
            dir="ltr"
            className="min-w-48 flex-1"
            maxLength={50}
            value={value}
            disabled={save.isPending}
            onChange={(e) => setValue(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
            aria-invalid={!valid || undefined}
          />
          <Button
            type="button"
            variant="outline"
            disabled={
              save.isPending ||
              username === vendor.slug ||
              !valid ||
              debounced !== username ||
              check.isFetching ||
              !check.data?.available ||
              check.isError
            }
            onClick={() => save.mutate(username)}
          >
            {t('profile.reserveUsername')}
          </Button>
        </div>
        <p dir="ltr" className="break-all text-sm text-muted-foreground">
          {config.webUrl}/{username}
        </p>
        <p role="status" className="text-sm text-muted-foreground">
          {!valid
            ? t('profile.usernameFormat')
            : check.isError
              ? errorMessage(check.error)
              : debounced !== username || check.isFetching
                ? t('profile.checkingUsername')
                : check.data?.available
                  ? t('profile.usernameAvailable')
                  : t('profile.usernameTaken')}
        </p>
      </Field>
    </div>
  );
}
