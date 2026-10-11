import { useMutation } from '@tanstack/react-query';
import { Check, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { errorMessage, type Vendor, type VendorBranding, type VendorCategory } from '../lib/api';
import { CARD_DESIGNS, cardDesign, categoryLabel, designName, VENDOR_CATEGORIES } from '../lib/cardDesigns';
import { t } from '../i18n';
import { CardPreview } from './CardPreview';
import { DvoteLogo } from './DvoteLogo';

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/heic';
const NONE = 'none';

/**
 * How a vendor looks in the customer app: its category, the shop-page banner and the design of
 * its loyalty cards (one of 10). The same panel serves a platform admin (any vendor) and a
 * vendor admin (their own vendor): only the save / upload calls differ.
 */
export function BrandingPanel({
  vendor,
  canEdit,
  save,
  uploadBanner,
  removeBanner,
  onSaved,
}: {
  vendor: Vendor;
  canEdit: boolean;
  save: (body: Partial<VendorBranding>) => Promise<Vendor>;
  uploadBanner: (f: File) => Promise<Vendor>;
  removeBanner: () => Promise<Vendor>;
  onSaved: (v: Vendor) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const done = (text: string) => (v: Vendor) => {
    onSaved(v);
    toast.success(text);
  };
  const fail = (e: unknown) => void toast.error(errorMessage(e));

  const update = useMutation({ mutationFn: save, onError: fail });
  const banner = useMutation({ mutationFn: uploadBanner, onSuccess: done(t('branding.bannerSaved')), onError: fail });
  const dropBanner = useMutation({ mutationFn: removeBanner, onSuccess: done(t('branding.bannerRemoved')), onError: fail });
  const shown = cardDesign(vendor.id, vendor.cardDesign);

  return (
    <div className="grid gap-8">
      {/* Category */}
      <section className="grid gap-2">
        <h3 className="font-semibold">{t('branding.category')}</h3>
        <p className="text-sm text-muted-foreground">{t('branding.categoryHint')}</p>
        <Select
          value={vendor.category ?? NONE}
          disabled={!canEdit || update.isPending}
          onValueChange={(v) =>
            update.mutate({ category: v === NONE ? null : (v as VendorCategory) }, { onSuccess: done(t('branding.categorySaved')) })
          }
        >
          <SelectTrigger className="w-full max-w-xs" aria-label={t('branding.category')}>
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
      </section>

      {/* Banner */}
      <section className="grid gap-2">
        <h3 className="font-semibold">{t('branding.banner')}</h3>
        <p className="text-sm text-muted-foreground">{t('branding.bannerHint')}</p>
        <div className="flex flex-wrap items-end gap-4">
          <div
            className="relative aspect-[2/1] w-full max-w-md overflow-hidden rounded-xl border"
            style={vendor.bannerUrl ? undefined : { background: `linear-gradient(135deg, ${shown.colors[0]}, ${shown.colors[1]})` }}
          >
            {vendor.bannerUrl ? (
              <img src={vendor.bannerUrl} alt="" className="size-full object-cover" />
            ) : (
              <>
                <div className="absolute -top-[10%] -end-[10%]">
                  <DvoteLogo height={200} wordmark={false} color="rgba(255,255,255,0.12)" />
                </div>
                <span className="absolute start-3 bottom-2 rounded-full bg-black/45 px-2 py-0.5 text-xs text-white">
                  {t('branding.noBanner')}
                </span>
              </>
            )}
            {banner.isPending || dropBanner.isPending ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Loader2 className="size-6 animate-spin text-white" />
              </div>
            ) : null}
          </div>
          {canEdit ? (
            <div className="flex gap-2">
              <Button variant="outline" disabled={banner.isPending} onClick={() => fileInput.current?.click()}>
                <ImagePlus /> {vendor.bannerUrl ? t('branding.replace') : t('branding.upload')}
              </Button>
              {vendor.bannerUrl ? (
                <Button variant="ghost" className="text-destructive" disabled={dropBanner.isPending} onClick={() => dropBanner.mutate()}>
                  <Trash2 /> {t('common.remove')}
                </Button>
              ) : null}
              <input
                ref={fileInput}
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
          ) : null}
        </div>
      </section>

      {/* Card design */}
      <section className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">{t('branding.design')}</h3>
          {canEdit && vendor.cardDesign ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={update.isPending}
              onClick={() => update.mutate({ cardDesign: null }, { onSuccess: done(t('branding.automaticToast')) })}
            >
              {t('branding.automatic')}
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {t('branding.designHint', { shop: vendor.name })}{' '}
          {vendor.cardDesign ? t('branding.now', { design: designName(shown) }) : t('branding.noneChosen', { design: designName(shown) })}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {CARD_DESIGNS.map((d) => {
            const selected = vendor.cardDesign === d.id;
            const pending = update.isPending && update.variables?.cardDesign === d.id;
            return (
              <button
                key={d.id}
                type="button"
                disabled={!canEdit || update.isPending}
                onClick={() => update.mutate({ cardDesign: d.id }, { onSuccess: done(t('branding.designToast', { design: designName(d) })) })}
                className={cn(
                  'group grid gap-1.5 rounded-2xl p-1.5 text-start outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50',
                  selected ? 'bg-brand-soft ring-2 ring-primary' : 'enabled:hover:bg-muted',
                  !canEdit && 'cursor-default',
                )}
                aria-pressed={selected}
                aria-label={t('branding.designLabel', { n: d.id, design: designName(d) })}
              >
                <CardPreview design={d} name={vendor.name} logoUrl={vendor.logoUrl} />
                <span className="flex items-center gap-1.5 px-1 text-sm font-medium">
                  {pending ? <Loader2 className="size-3.5 animate-spin" /> : selected ? <Check className="size-3.5 text-primary" /> : null}
                  {d.id}. {designName(d)}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
