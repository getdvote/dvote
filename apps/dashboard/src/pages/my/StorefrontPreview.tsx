import { useQuery } from '@tanstack/react-query';
import { MapPointIcon as MapPin } from '@solar-icons/react/linear';
import { Button } from '@/components/ui/button';
import { CardPreview } from '../../components/CardPreview';
import { initial, num } from '../../components/PageHeader';
import { useMyScope, useMyVendor } from '../../layouts/VendorLayout';
import { cardDesign, categoryLabel } from '../../lib/cardDesigns';
import { cityName } from '../../lib/cities';
import { defaultShader, shaderCss } from '../../lib/coverShaders';
import { t } from '../../i18n';

const money = (v: string) => v.replace(/\.00$/, '');

/**
 * The shop page as customers see it in the dvote app, drawn in a phone from the live data:
 * banner, logo, name, category, the loyalty card, how to earn, rewards, menu pages, branches.
 * A close likeness, not the app itself.
 */
export function StorefrontPreview({ onEdit }: { onEdit: () => void }) {
  const vendor = useMyVendor();
  const scope = useMyScope();
  const { data: rules } = useQuery({ queryKey: ['point-rules', scope.key], queryFn: () => scope.pointRules() });
  const { data: rewards } = useQuery({ queryKey: ['rewards', scope.key], queryFn: () => scope.rewards() });
  const { data: images } = useQuery({ queryKey: ['images', scope.key], queryFn: () => scope.images() });
  const { data: branches } = useQuery({ queryKey: ['branches', scope.key], queryFn: () => scope.branches() });

  const design = cardDesign(vendor.id, vendor.cardDesign);
  const rule = rules?.find((r) => r.isActive);
  const active = (rewards ?? []).filter((r) => r.status === 'active').sort((a, b) => a.sortOrder - b.sortOrder);
  const menu = (images ?? []).filter((i) => i.kind === 'menu').sort((a, b) => a.sortOrder - b.sortOrder);
  const open = (branches ?? []).filter((b) => b.status === 'active');
  const category = categoryLabel(vendor.category);

  return (
    <div className="grid justify-items-center gap-4 lg:justify-items-start">
      <div>
        <div className="text-sm text-muted-foreground">{t('profile.whatCustomersSee')}</div>
        <p className="text-xs text-muted-foreground">{t('profile.previewHint')}</p>
      </div>

      {/* the phone */}
      <div className="rounded-[3rem] bg-neutral-900 p-3 shadow-xl ring-1 ring-black/10">
        <div className="relative h-[680px] w-[330px] overflow-hidden rounded-[2.4rem] bg-white text-neutral-900" dir="ltr">
          <div className="absolute top-2.5 left-1/2 z-10 h-7 w-28 -translate-x-1/2 rounded-full bg-black" aria-hidden />
          <div className="h-full overflow-y-auto pb-8 [scrollbar-width:none]">
            {/* banner */}
            <div
              className="h-44 w-full bg-cover bg-center"
              style={vendor.bannerUrl ? { backgroundImage: `url(${vendor.bannerUrl})` } : { background: shaderCss(defaultShader(vendor.id)) }}
            />
            <div className="-mt-10 px-5">
              <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-neutral-100 text-2xl font-semibold shadow-sm">
                {vendor.logoUrl ? <img src={vendor.logoUrl} alt="" className="size-full object-cover" /> : initial(vendor.name)}
              </div>
              <h3 className="mt-3 text-xl font-bold">{vendor.name}</h3>
              {category ? <p className="text-sm text-neutral-500">{category}</p> : null}

              <CardPreview design={design} name={vendor.name} logoUrl={vendor.logoUrl} points={0} className="mt-4" />

              <div className="mt-4 rounded-2xl bg-neutral-100 px-4 py-3">
                <div className="text-xs font-medium text-neutral-500">{t('profile.earn')}</div>
                <div className="text-sm font-semibold">
                  {rule ? t('till.rule', { spend: money(rule.spendAmount), currency: vendor.currency, points: rule.pointsPerSpend }) : t('profile.noRule')}
                </div>
              </div>

              <h4 className="mt-5 mb-2 text-sm font-semibold">{t('nav.rewards')}</h4>
              {active.length ? (
                <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
                  {active.map((r) => (
                    <div key={r.id} className="w-32 shrink-0 overflow-hidden rounded-2xl border border-neutral-200">
                      <div className="h-20 bg-neutral-100 bg-cover bg-center" style={r.imageUrl ? { backgroundImage: `url(${r.imageUrl})` } : undefined} />
                      <div className="p-2">
                        <div className="truncate text-xs font-semibold">{r.name}</div>
                        <div className="text-[11px] text-neutral-500">{t('profile.pts', { n: num(r.pointsCost) })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-500">{t('profile.noRewards')}</p>
              )}

              {menu.length ? (
                <>
                  <h4 className="mt-5 mb-2 text-sm font-semibold">{t('nav.menu')}</h4>
                  <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
                    {menu.map((m) => (
                      <img key={m.id} src={m.url} alt="" className="h-28 w-20 shrink-0 rounded-xl border border-neutral-200 object-cover" />
                    ))}
                  </div>
                </>
              ) : null}

              {open.length ? (
                <>
                  <h4 className="mt-5 mb-2 text-sm font-semibold">{t('nav.branches')}</h4>
                  <div className="grid gap-2">
                    {open.map((b) => (
                      <div key={b.id} className="flex gap-2.5 rounded-2xl border border-neutral-200 p-3">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-neutral-500" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{b.name}</div>
                          <div className="truncate text-xs text-neutral-500">{[b.address, cityName(b.city)].filter(Boolean).join(', ')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>
          <div className="absolute bottom-2 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full bg-neutral-900/80" aria-hidden />
        </div>
      </div>

      <Button variant="outline" onClick={onEdit}>
        {t('profile.editBranding')}
      </Button>
    </div>
  );
}
