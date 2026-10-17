import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircleIcon as CheckCircle, LoaderIcon as Loader2 } from '@solar-icons/react/linear';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Field } from '../../components/Field';
import { initial } from '../../components/PageHeader';
import { useMyVendor } from '../../layouts/VendorLayout';
import { errorMessage, vendorApi, type BrandFont, type PageStyle, type Vendor } from '../../lib/api';
import { cardDesign } from '../../lib/cardDesigns';
import { BRAND_FONTS, loadFonts, PAGE_STYLES } from '../../lib/storefront';
import { t } from '../../i18n';

const SAVE_KEY = ['vendor-style', 'save'];
const DEFAULT_FONT = 'default';
const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Settings → Branding, the public page's look: page style (3 layouts), brand colours and the
 * display font. Saves on its own; the customer page (and the Storefront preview) follow.
 */
export function BrandStyleEditor() {
  const vendor = useMyVendor();
  const qc = useQueryClient();
  const save = useMutation({
    mutationKey: SAVE_KEY,
    mutationFn: vendorApi.updateProfile,
    onSuccess: (v: Vendor) => qc.setQueryData(['vendor', 'me'], v),
    onError: (e) => void toast.error(errorMessage(e)),
  });
  const design = cardDesign(vendor.id, vendor.cardDesign);
  const primary = vendor.brandPrimary ?? design.colors[0];
  const secondary = vendor.brandSecondary ?? design.colors[1];
  const style = vendor.pageStyle ?? 'spotlight';
  const font = vendor.brandFont ? BRAND_FONTS[vendor.brandFont] : undefined;
  useEffect(() => loadFonts(Object.values(BRAND_FONTS)), []);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('brandStyle.pageStyle')}</CardTitle>
          <CardDescription>{t('brandStyle.pageStyleHint')}</CardDescription>
          <CardAction>
            <SaveStatus />
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {PAGE_STYLES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={style === s}
              onClick={() => style !== s && save.mutate({ pageStyle: s })}
              className={cn(
                'grid gap-3 rounded-2xl border p-3 text-start outline-none transition duration-100 ease-linear focus-visible:ring-3 focus-visible:ring-ring/50',
                style === s ? 'border-primary bg-brand-soft ring-1 ring-primary' : 'hover:bg-muted',
              )}
            >
              <StyleMock style={s} name={vendor.name} logoUrl={vendor.logoUrl} primary={primary} secondary={secondary} font={font} />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {t(`brandStyle.styles.${s}.name`)}
                  {style === s ? <CheckCircle className="size-4 text-primary" /> : null}
                </span>
                <span className="block text-xs text-muted-foreground">{t(`brandStyle.styles.${s}.hint`)}</span>
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('brandStyle.colors')}</CardTitle>
            <CardDescription>{t('brandStyle.colorsHint')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ColorField
              id="brand-primary"
              label={t('brandStyle.primary')}
              value={primary}
              custom={!!vendor.brandPrimary}
              onSave={(v) => save.mutate({ brandPrimary: v })}
            />
            <ColorField
              id="brand-secondary"
              label={t('brandStyle.secondary')}
              value={secondary}
              custom={!!vendor.brandSecondary}
              onSave={(v) => save.mutate({ brandSecondary: v })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('brandStyle.font')}</CardTitle>
            <CardDescription>{t('brandStyle.fontHint')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Select
              value={vendor.brandFont ?? DEFAULT_FONT}
              onValueChange={(v) => save.mutate({ brandFont: v === DEFAULT_FONT ? null : (v as BrandFont) })}
            >
              <SelectTrigger className="w-full" aria-label={t('brandStyle.font')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_FONT}>{t('brandStyle.defaultFont')}</SelectItem>
                {(Object.keys(BRAND_FONTS) as BrandFont[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    <span style={{ fontFamily: `"${BRAND_FONTS[k]}"` }}>{BRAND_FONTS[k]}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="rounded-xl bg-muted px-4 py-3 text-2xl" style={{ fontFamily: font ? `"${font}"` : undefined }}>
              {vendor.name} · مرحبًا
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SaveStatus() {
  const saving = useIsMutating({ mutationKey: SAVE_KEY }) > 0;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
      {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle className="size-3.5" />}
      {saving ? t('profile.saving') : t('profile.allSaved')}
    </span>
  );
}

/** A colour swatch (system picker) + its hex code; saves when a valid colour is settled on. */
function ColorField({
  id,
  label,
  value,
  custom,
  onSave,
}: {
  id: string;
  label: string;
  value: string;
  custom: boolean;
  onSave: (v: string | null) => void;
}) {
  const [text, setText] = useState(value);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => setText(value), [value]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const later = (v: string) => {
    setText(v);
    window.clearTimeout(timer.current);
    if (HEX.test(v)) timer.current = window.setTimeout(() => v.toLowerCase() !== value.toLowerCase() && onSave(v.toLowerCase()), 600);
  };
  return (
    <Field
      label={
        <span className="flex items-center gap-2">
          {label}
          {!custom ? <span className="text-xs font-normal text-muted-foreground">{t('brandStyle.fromCard')}</span> : null}
        </span>
      }
      htmlFor={id}
    >
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={HEX.test(text) ? text : value}
          onChange={(e) => later(e.target.value)}
          className="size-10 shrink-0 cursor-pointer rounded-lg border bg-transparent p-1"
        />
        <Input id={id} dir="ltr" maxLength={7} className="font-mono" value={text} onChange={(e) => later(e.target.value.trim())} />
        {custom ? (
          <Button variant="ghost" size="sm" onClick={() => onSave(null)}>
            {t('brandStyle.reset')}
          </Button>
        ) : null}
      </div>
    </Field>
  );
}

/** A small drawing of each page style, in the merchant's colours and font. */
function StyleMock({
  style,
  name,
  logoUrl,
  primary,
  secondary,
  font,
}: {
  style: PageStyle;
  name: string;
  logoUrl: string | null;
  primary: string;
  secondary: string;
  font?: string;
}) {
  const logo = (cls: string) =>
    logoUrl ? (
      <img src={logoUrl} alt="" className={cn('rounded-lg object-cover', cls)} />
    ) : (
      <span className={cn('flex items-center justify-center rounded-lg text-xs font-bold text-white', cls)} style={{ background: primary }}>
        {initial(name)}
      </span>
    );
  const lines = (
    <div className="grid gap-1.5">
      <span className="flex items-center gap-1.5 rounded-lg border bg-white p-1.5">
        <span className="size-4 rounded" style={{ background: primary }} />
        <span className="h-1.5 flex-1 rounded bg-neutral-200" />
      </span>
      <span className="h-6 rounded-lg border bg-white" />
      <span className="h-6 rounded-lg border bg-white" />
    </div>
  );
  return (
    <span className="block aspect-[3/4] w-full overflow-hidden rounded-xl border bg-neutral-50 text-neutral-900" dir="ltr">
      {style === 'branded' ? (
        <span className="flex h-full flex-col">
          <span className="flex flex-col items-center gap-1 px-3 pt-4 pb-6" style={{ background: `linear-gradient(160deg, ${primary}, ${secondary})` }}>
            {logo('size-8')}
            <span className="truncate text-[9px] font-semibold tracking-widest text-white uppercase" style={{ fontFamily: font }}>
              {name}
            </span>
          </span>
          <span className="-mt-3 flex-1 rounded-t-xl bg-white p-2">{lines}</span>
        </span>
      ) : style === 'compact' ? (
        <span className="flex h-full flex-col gap-2 bg-white p-2">
          <span className="flex items-center gap-1.5 border-b pb-1.5">
            {logo('size-5')}
            <span className="truncate text-[10px] font-semibold" style={{ fontFamily: font }}>
              {name}
            </span>
          </span>
          {lines}
        </span>
      ) : (
        <span className="flex h-full flex-col items-center gap-1.5 bg-white p-2 pt-4">
          {logo('size-9')}
          <span className="truncate text-[9px] font-semibold tracking-widest text-neutral-500 uppercase" style={{ fontFamily: font }}>
            {name}
          </span>
          <span className="w-full">{lines}</span>
        </span>
      )}
    </span>
  );
}
